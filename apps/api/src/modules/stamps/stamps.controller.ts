import { Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { adjustSchema, manualStampSchema, redeemCodeSchema, redeemSchema } from '@tably/types';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { Can, Tenant } from '../../common/guards';
import type { TenantContext } from '../../common/auth.types';
import { PrismaService, type Prisma } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, notFound } from '../../common/errors';
import { LedgerService } from '../ledger/ledger.service';

const listSchema = z.object({
  flagged: z.enum(['true', 'false']).optional(),
  type: z.enum(['EARN', 'REDEEM', 'ADJUST', 'REVERSAL']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const reverseSchema = z.object({ note: z.string().trim().max(200).optional() });
const lookupSchema = z.object({ code: z.string().trim().min(4).max(20) });

function requireKey(header: string | undefined): string {
  if (!header || !/^[A-Za-z0-9_.:-]{8,100}$/.test(header)) {
    throw new AppError('validation_failed', 'Der Header „Idempotency-Key“ fehlt oder ist ungültig.');
  }
  return `client:${header}`;
}

@ApiTags('Buchungen')
@Controller('stamps')
export class StampsController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertLocation(ctx: TenantContext, locationId: string | null | undefined): Promise<void> {
    if (!locationId) return;
    const location = await this.prisma.location.findFirst({ where: { id: locationId, organizationId: ctx.organizationId }, select: { id: true } });
    if (!location) throw notFound('Standort');
  }

  @Get()
  @Can('customers.read')
  async list(@Tenant() ctx: TenantContext, @ZQuery(listSchema) query: z.infer<typeof listSchema>) {
    const where: Prisma.StampTransactionWhereInput = {
      organizationId: ctx.organizationId,
      ...(query.flagged ? { flagged: query.flagged === 'true' } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.stampTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { card: { select: { shortCode: true, customer: { select: { id: true, firstName: true, lastName: true } }, program: { select: { name: true } } } } },
      }),
      this.prisma.stampTransaction.count({ where }),
    ]);
    const [devices, staff, locations] = await Promise.all([
      this.prisma.nfcDevice.findMany({ where: { id: { in: items.map((i) => i.deviceId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: items.map((i) => i.staffUserId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } }),
      this.prisma.location.findMany({ where: { id: { in: items.map((i) => i.locationId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } }),
    ]);
    const name = (list: Array<{ id: string; name: string }>, id: string | null) => (id ? (list.find((x) => x.id === id)?.name ?? null) : null);
    return {
      items: items.map(({ card, ...t }) => ({
        ...t,
        shortCode: card.shortCode,
        programName: card.program.name,
        customer: card.customer,
        deviceName: name(devices, t.deviceId),
        staffName: name(staff, t.staffUserId),
        locationName: name(locations, t.locationId),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Post('lookup')
  @HttpCode(200)
  @Can('stamps.grant')
  @ApiOperation({ summary: 'Karte über den Kartencode finden (Theke)' })
  async lookup(@Tenant() ctx: TenantContext, @ZBody(lookupSchema) body: z.infer<typeof lookupSchema>) {
    const raw = body.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const shortCode = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : body.code.toUpperCase();
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { organizationId: ctx.organizationId, shortCode },
      include: { customer: { select: { id: true, firstName: true, lastName: true, status: true } }, program: { include: { rewards: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }] } } } },
    });
    if (!card) throw notFound('Karte');
    return {
      cardId: card.id,
      shortCode: card.shortCode,
      status: card.status,
      balance: card.balance,
      lastStampAt: card.lastStampAt,
      customer: card.customer,
      program: { id: card.program.id, name: card.program.name, stampsRequired: card.program.stampsRequired },
      rewards: card.program.rewards.map((r) => ({ id: r.id, name: r.name, cost: r.cost, available: card.balance >= r.cost })),
    };
  }

  @Post('manual')
  @HttpCode(200)
  @Can('stamps.grant')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiZodBody(manualStampSchema)
  async manual(@Tenant() ctx: TenantContext, @Headers('idempotency-key') key: string | undefined, @ZBody(manualStampSchema) body: z.infer<typeof manualStampSchema>) {
    await this.assertLocation(ctx, body.locationId);
    const result = await this.ledger.earn({
      organizationId: ctx.organizationId,
      cardId: body.cardId,
      amount: body.amount,
      source: 'MANUAL',
      idempotencyKey: requireKey(key),
      staffUserId: ctx.userId,
      locationId: body.locationId,
      note: body.note,
      // Mitarbeitende dürfen Limits übersteuern; die Buchung wird dann markiert.
      enforceLimits: false,
    });
    if (!result.duplicate) {
      await this.audit.byUser(ctx, 'stamp.manual', { type: 'StampTransaction', id: result.transaction.id }, { amount: result.transaction.amount, flagged: result.transaction.flagged });
    }
    return { transactionId: result.transaction.id, amount: result.transaction.amount, balance: result.card.balance, duplicate: result.duplicate, flagged: result.transaction.flagged };
  }

  @Post('adjust')
  @HttpCode(200)
  @Can('stamps.adjust')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiZodBody(adjustSchema)
  async adjust(@Tenant() ctx: TenantContext, @Headers('idempotency-key') key: string | undefined, @ZBody(adjustSchema) body: z.infer<typeof adjustSchema>) {
    const result = await this.ledger.adjust({ organizationId: ctx.organizationId, cardId: body.cardId, delta: body.delta, note: body.note, staffUserId: ctx.userId, idempotencyKey: requireKey(key) });
    if (!result.duplicate) await this.audit.byUser(ctx, 'stamp.adjusted', { type: 'StampTransaction', id: result.transaction.id }, { delta: body.delta, note: body.note });
    return { transactionId: result.transaction.id, balance: result.card.balance, duplicate: result.duplicate };
  }

  @Post('redeem')
  @HttpCode(200)
  @Can('stamps.grant')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiZodBody(redeemSchema)
  async redeem(@Tenant() ctx: TenantContext, @Headers('idempotency-key') key: string | undefined, @ZBody(redeemSchema) body: z.infer<typeof redeemSchema>) {
    await this.assertLocation(ctx, body.locationId);
    const result = await this.ledger.redeemDirect({ organizationId: ctx.organizationId, cardId: body.cardId, rewardId: body.rewardId, staffUserId: ctx.userId, locationId: body.locationId, idempotencyKey: requireKey(key) });
    if (!result.duplicate) await this.audit.byUser(ctx, 'reward.redeemed', { type: 'StampTransaction', id: result.transaction.id }, { rewardId: body.rewardId });
    return { transactionId: result.transaction.id, balance: result.card.balance, duplicate: result.duplicate };
  }

  @Post('redeem-code')
  @HttpCode(200)
  @Can('stamps.grant')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Einlöse-Code des Kunden bestätigen' })
  @ApiZodBody(redeemCodeSchema)
  async redeemCode(@Tenant() ctx: TenantContext, @ZBody(redeemCodeSchema) body: z.infer<typeof redeemCodeSchema>) {
    await this.assertLocation(ctx, body.locationId);
    const result = await this.ledger.confirmRedemptionCode({ organizationId: ctx.organizationId, code: body.code, staffUserId: ctx.userId, locationId: body.locationId });
    await this.audit.byUser(ctx, 'reward.redeemed', { type: 'StampTransaction', id: result.transaction.id }, { via: 'code' });
    return { transactionId: result.transaction.id, balance: result.card.balance, rewardName: result.rewardName, customerName: result.customerName };
  }

  @Post(':id/reverse')
  @HttpCode(200)
  @Can('stamps.adjust')
  async reverse(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(reverseSchema) body: z.infer<typeof reverseSchema>) {
    const result = await this.ledger.reverse({ organizationId: ctx.organizationId, transactionId: id, staffUserId: ctx.userId, note: body.note });
    await this.audit.byUser(ctx, 'stamp.reversed', { type: 'StampTransaction', id }, { reversalId: result.transaction.id });
    return { transactionId: result.transaction.id, balance: result.card.balance };
  }
}
