import { Injectable } from '@nestjs/common';
import type { ConsentType } from '@tapperl/database';
import type { z } from 'zod';
import { PRIVACY_POLICY_VERSION } from '@tapperl/config';
import type { customerCreateSchema, customerListQuerySchema, customerUpdateSchema } from '@tapperl/types';
import { Prisma, PrismaService, isUniqueViolation, type Tx } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { AppError, notFound } from '../../common/errors';
import { addDays } from '../../common/util';
import type { TenantContext } from '../../common/auth.types';
import { CardsService } from '../cards/cards.service';

type ListQuery = z.infer<typeof customerListQuerySchema>;

const birthdayDate = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00.000Z`) : iso === null ? null : undefined);

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly cards: CardsService,
  ) {}

  /** Aktueller Einwilligungsstand: jüngster Eintrag je Typ. */
  async consentState(customerId: string, tx: Tx | PrismaService = this.prisma): Promise<Record<ConsentType, { granted: boolean; at: Date } | null>> {
    const rows = await tx.consentRecord.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
    const state: Record<ConsentType, { granted: boolean; at: Date } | null> = { TERMS: null, PRIVACY: null, MARKETING_EMAIL: null, MARKETING_WALLET: null };
    for (const row of rows) if (!state[row.type]) state[row.type] = { granted: row.granted, at: row.createdAt };
    return state;
  }

  recordConsent(tx: Tx | PrismaService, input: { organizationId: string; customerId: string; type: ConsentType; granted: boolean; source: string; ip?: string | null; userAgent?: string | null }) {
    return tx.consentRecord.create({ data: { ...input, policyVersion: PRIVACY_POLICY_VERSION, ip: input.ip ?? null, userAgent: input.userAgent ?? null } });
  }

  private listWhere(ctx: TenantContext, query: ListQuery): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { organizationId: ctx.organizationId };
    const and: Prisma.CustomerWhereInput[] = [];
    if (query.status) where.status = query.status;
    else where.status = { not: 'ANONYMIZED' };
    if (query.q) {
      const code = query.q.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const shortCode = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : null;
      // Jedes Wort muss in mindestens einem Feld vorkommen („Mara Schmidt“ findet Vor- und Nachname).
      const words = query.q.split(/\s+/).filter(Boolean).slice(0, 5);
      const byWords: Prisma.CustomerWhereInput = {
        AND: words.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: 'insensitive' as const } },
            { lastName: { contains: word, mode: 'insensitive' as const } },
            { email: { contains: word, mode: 'insensitive' as const } },
            { phone: { contains: word } },
          ],
        })),
      };
      and.push(shortCode ? { OR: [byWords, { cards: { some: { shortCode } } }] } : byWords);
    }
    if (query.programId) and.push({ cards: { some: { programId: query.programId } } });
    const now = new Date();
    if (query.activity === 'active30') and.push({ lastActivityAt: { gte: addDays(now, -30) } });
    if (query.activity === 'inactive60') and.push({ OR: [{ lastActivityAt: { lt: addDays(now, -60) } }, { lastActivityAt: null, createdAt: { lt: addDays(now, -60) } }] });
    if (query.activity === 'new30') and.push({ createdAt: { gte: addDays(now, -30) } });
    if (and.length) where.AND = and;
    return where;
  }

  async list(ctx: TenantContext, query: ListQuery) {
    let where = this.listWhere(ctx, query);
    if (query.activity === 'reward_ready') {
      // Karten, deren Stand für die günstigste aktive Prämie reicht
      const rows = await this.prisma.$queryRaw<Array<{ customerId: string }>>`
        SELECT DISTINCT c."customerId" FROM "LoyaltyCard" c
        JOIN LATERAL (SELECT min(r.cost) AS cost FROM "Reward" r WHERE r."programId" = c."programId" AND r."isActive") m ON true
        WHERE c."organizationId" = ${ctx.organizationId} AND m.cost IS NOT NULL AND c.balance >= m.cost AND c.status = 'ACTIVE'`;
      where = { AND: [where, { id: { in: rows.map((r) => r.customerId) } }] };
    }
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
      query.sort === 'name' ? [{ firstName: 'asc' }, { lastName: 'asc' }] : query.sort === 'created' ? [{ createdAt: 'desc' }] : [{ lastActivityAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { cards: { select: { id: true, balance: true, shortCode: true, status: true, programId: true, visits: true, program: { select: { name: true, stampsRequired: true } } } } },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  private async load(ctx: TenantContext, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!customer) throw notFound('Kunde');
    return customer;
  }

  async get(ctx: TenantContext, id: string) {
    const customer = await this.load(ctx, id);
    const [cards, consents, transactions, redemptions, notifications] = await Promise.all([
      this.prisma.loyaltyCard.findMany({
        where: { customerId: id, organizationId: ctx.organizationId },
        include: { program: { include: { rewards: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }] } } }, walletPasses: { select: { platform: true, createdAt: true } } },
      }),
      this.consentState(id),
      this.prisma.stampTransaction.findMany({ where: { customerId: id, organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.rewardRedemption.findMany({ where: { customerId: id, organizationId: ctx.organizationId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, take: 20 }),
      this.prisma.notification.count({ where: { customerId: id, organizationId: ctx.organizationId } }),
    ]);
    const ids = { locations: new Set<string>(), devices: new Set<string>(), staff: new Set<string>() };
    for (const t of transactions) {
      if (t.locationId) ids.locations.add(t.locationId);
      if (t.deviceId) ids.devices.add(t.deviceId);
      if (t.staffUserId) ids.staff.add(t.staffUserId);
    }
    const [locations, devices, staff] = await Promise.all([
      this.prisma.location.findMany({ where: { id: { in: [...ids.locations] } }, select: { id: true, name: true } }),
      this.prisma.nfcDevice.findMany({ where: { id: { in: [...ids.devices] } }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { id: { in: [...ids.staff] } }, select: { id: true, name: true } }),
    ]);
    const name = (list: Array<{ id: string; name: string }>, key: string | null) => (key ? (list.find((x) => x.id === key)?.name ?? null) : null);
    return {
      customer,
      consents,
      notificationCount: notifications,
      cards: cards.map((c) => ({
        id: c.id,
        shortCode: c.shortCode,
        status: c.status,
        balance: c.balance,
        lifetimeEarned: c.lifetimeEarned,
        lifetimeRedeemed: c.lifetimeRedeemed,
        visits: c.visits,
        lastStampAt: c.lastStampAt,
        createdAt: c.createdAt,
        wallets: c.walletPasses.map((w) => w.platform),
        program: { id: c.program.id, name: c.program.name, stampsRequired: c.program.stampsRequired, type: c.program.type, status: c.program.status },
        rewards: c.program.rewards.map((r) => ({ id: r.id, name: r.name, cost: r.cost, available: c.balance >= r.cost })),
      })),
      transactions: transactions.map((t) => ({ ...t, locationName: name(locations, t.locationId), deviceName: name(devices, t.deviceId), staffName: name(staff, t.staffUserId) })),
      redemptions,
    };
  }

  async create(ctx: TenantContext, input: z.infer<typeof customerCreateSchema>) {
    await this.entitlements.assertLimit(ctx.organizationId, 'customers', 'Kunden');
    const program = await this.prisma.loyaltyProgram.findFirst({ where: { id: input.programId, organizationId: ctx.organizationId, status: { in: ['PUBLISHED', 'PAUSED', 'DRAFT'] } } });
    if (!program) throw notFound('Treueprogramm');
    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            organizationId: ctx.organizationId,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email ?? null,
            phone: input.phone,
            birthday: birthdayDate(input.birthday) ?? null,
            source: 'staff',
          },
        });
        await this.cards.createCard(tx, { organizationId: ctx.organizationId, program, customerId: created.id });
        return created;
      });
      await this.audit.byUser(ctx, 'customer.created', { type: 'Customer', id: customer.id });
      return this.get(ctx, customer.id);
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError('email_taken', 'Es gibt bereits einen Kunden mit dieser E-Mail-Adresse.', { fields: { email: 'Bereits vergeben' } });
      throw err;
    }
  }

  async update(ctx: TenantContext, id: string, input: z.infer<typeof customerUpdateSchema>) {
    const customer = await this.load(ctx, id);
    if (customer.status === 'ANONYMIZED') throw new AppError('conflict', 'Dieser Kunde wurde gelöscht.');
    const { birthday, ...rest } = input;
    try {
      await this.prisma.customer.update({ where: { id }, data: { ...rest, ...(birthday !== undefined ? { birthday: birthdayDate(birthday) } : {}) } });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError('email_taken', 'Es gibt bereits einen Kunden mit dieser E-Mail-Adresse.', { fields: { email: 'Bereits vergeben' } });
      throw err;
    }
    await this.audit.byUser(ctx, input.status && input.status !== customer.status ? `customer.${input.status.toLowerCase()}` : 'customer.updated', { type: 'Customer', id }, { fields: Object.keys(input) });
    return this.get(ctx, id);
  }

  async setConsent(ctx: TenantContext, id: string, type: 'MARKETING_EMAIL' | 'MARKETING_WALLET', granted: boolean) {
    await this.load(ctx, id);
    await this.recordConsent(this.prisma, { organizationId: ctx.organizationId, customerId: id, type, granted, source: `staff:${ctx.userId}`, ip: ctx.ip, userAgent: ctx.userAgent });
    await this.audit.byUser(ctx, 'customer.consent_changed', { type: 'Customer', id }, { consent: type, granted });
    return this.consentState(id);
  }

  /** Auskunft nach Art. 15/20 DSGVO: alle zum Kunden gespeicherten Daten. */
  async exportData(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, organizationId } });
    if (!customer) throw notFound('Kunde');
    const [cards, consents, transactions, redemptions, notifications] = await Promise.all([
      this.prisma.loyaltyCard.findMany({
        where: { customerId: id },
        select: { id: true, shortCode: true, status: true, balance: true, lifetimeEarned: true, lifetimeRedeemed: true, visits: true, createdAt: true, lastStampAt: true, expiresAt: true, program: { select: { name: true } }, walletPasses: { select: { platform: true, createdAt: true } } },
      }),
      this.prisma.consentRecord.findMany({ where: { customerId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.stampTransaction.findMany({ where: { customerId: id }, orderBy: { createdAt: 'asc' }, select: { id: true, type: true, source: true, amount: true, note: true, createdAt: true, cardId: true } }),
      this.prisma.rewardRedemption.findMany({ where: { customerId: id }, select: { id: true, rewardName: true, cost: true, status: true, createdAt: true, completedAt: true } }),
      this.prisma.notification.findMany({ where: { customerId: id }, select: { channel: true, subject: true, status: true, createdAt: true, sentAt: true } }),
    ]);
    return { exportedAt: new Date(), customer, cards, consents, transactions, redemptions, notifications };
  }

  async export(ctx: TenantContext, id: string) {
    const data = await this.exportData(ctx.organizationId, id);
    await this.audit.byUser(ctx, 'customer.exported', { type: 'Customer', id });
    return data;
  }

  /** CSV-Export der Kundenliste. */
  async exportCsv(ctx: TenantContext): Promise<string> {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId: ctx.organizationId, status: { not: 'ANONYMIZED' } },
      orderBy: { createdAt: 'asc' },
      include: { cards: { select: { balance: true, visits: true, shortCode: true, program: { select: { name: true } } } } },
    });
    const esc = (v: unknown) => {
      let s = v == null ? '' : String(v);
      // Schutz vor Formel-Injektion in Tabellenkalkulationen
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = ['Vorname;Nachname;E-Mail;Telefon;Geburtstag;Status;Programm;Kartencode;Stand;Besuche;Registriert;Letzte Aktivität'];
    for (const c of customers) {
      const cards = c.cards.length ? c.cards : [null];
      for (const card of cards) {
        lines.push(
          [c.firstName, c.lastName, c.email, c.phone, c.birthday?.toISOString().slice(0, 10), c.status, card?.program.name, card?.shortCode, card?.balance, card?.visits, c.createdAt.toISOString(), c.lastActivityAt?.toISOString()]
            .map(esc)
            .join(';'),
        );
      }
    }
    await this.audit.byUser(ctx, 'customer.list_exported', undefined, { count: customers.length });
    return `﻿${lines.join('\r\n')}\r\n`;
  }

  /**
   * Löschung nach Art. 17 DSGVO. Personenbezogene Daten werden entfernt,
   * die Buchungen bleiben ohne Personenbezug für die Statistik erhalten.
   */
  async anonymize(organizationId: string, id: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id, organizationId } });
    if (!customer) throw notFound('Kunde');
    await this.prisma.$transaction(async (tx) => {
      await tx.customerSession.deleteMany({ where: { customerId: id } });
      await tx.customerLoginToken.deleteMany({ where: { customerId: id } });
      await tx.walletPass.deleteMany({ where: { card: { customerId: id } } });
      await tx.rewardRedemption.updateMany({ where: { customerId: id, status: 'PENDING' }, data: { status: 'CANCELED', codeHash: null } });
      await tx.loyaltyCard.updateMany({ where: { customerId: id }, data: { status: 'BLOCKED' } });
      await tx.notification.updateMany({ where: { customerId: id }, data: { recipient: null, body: '', subject: '' } });
      await tx.consentRecord.updateMany({ where: { customerId: id }, data: { ip: null, userAgent: null } });
      await tx.tapEvent.updateMany({ where: { customerId: id, status: { in: ['VERIFIED', 'PENDING_APPROVAL', 'PENDING_POS'] } }, data: { status: 'REJECTED', rejectReason: 'customer_blocked', completedAt: new Date() } });
      await tx.tapEvent.updateMany({ where: { customerId: id }, data: { ip: null } });
      await tx.customer.update({
        where: { id },
        data: { firstName: 'Gelöscht', lastName: null, email: null, phone: null, birthday: null, note: null, status: 'ANONYMIZED', anonymizedAt: new Date() },
      });
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<void> {
    await this.anonymize(ctx.organizationId, id);
    await this.audit.byUser(ctx, 'customer.anonymized', { type: 'Customer', id });
  }
}
