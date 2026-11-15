import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { cardDesignSchema, type createProgramSchema, type rewardInputSchema, type updateProgramSchema } from '@tably/types';
import { ENV, type Env } from '../../common/env';
import { Prisma, PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { QueueService } from '../../common/queue.service';
import { AppError, notFound } from '../../common/errors';
import { slugify } from '../../common/util';
import type { TenantContext } from '../../common/auth.types';
import { CardsService, parseDesign } from '../cards/cards.service';

type RewardInput = z.infer<typeof rewardInputSchema>;

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly cards: CardsService,
    private readonly queue: QueueService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private signupUrl(orgSlug: string, programSlug: string): string {
    return `${this.env.WEB_URL.replace(/\/+$/, '')}/j/${orgSlug}/${programSlug}`;
  }

  private async load(ctx: TenantContext, id: string) {
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { rewards: { orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }] }, organization: true, _count: { select: { cards: true, devices: true } } },
    });
    if (!program) throw notFound('Treueprogramm');
    return program;
  }

  private dto(program: Awaited<ReturnType<ProgramsService['load']>>) {
    const { organization, _count, ...rest } = program;
    return {
      ...rest,
      design: parseDesign(program.design),
      cardCount: _count.cards,
      deviceCount: _count.devices,
      signupUrl: this.signupUrl(organization.slug, program.slug),
      preview: this.cards.programView(program, organization),
    };
  }

  async list(ctx: TenantContext) {
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: { organizationId: ctx.organizationId, status: { not: 'ARCHIVED' } },
      include: { rewards: { orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }] }, organization: true, _count: { select: { cards: true, devices: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return programs.map((p) => this.dto(p));
  }

  async get(ctx: TenantContext, id: string) {
    return this.dto(await this.load(ctx, id));
  }

  async create(ctx: TenantContext, input: z.infer<typeof createProgramSchema>) {
    await this.entitlements.assertLimit(ctx.organizationId, 'programs', 'Treueprogramme');
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
    const design = cardDesignSchema.parse({ backgroundColor: org.brandColor, ...(input.design ?? {}) });
    const base = slugify(input.name);
    let created;
    for (let i = 0; ; i++) {
      try {
        created = await this.prisma.loyaltyProgram.create({
          data: {
            organizationId: ctx.organizationId,
            type: input.type,
            name: input.name,
            slug: i === 0 ? base : `${base}-${i + 1}`,
            cardTitle: input.cardTitle,
            description: input.description,
            stampsRequired: input.stampsRequired,
            stampIcon: input.stampIcon,
            design,
            rewards: input.reward
              ? { create: { organizationId: ctx.organizationId, name: input.reward.name, description: input.reward.description ?? '', cost: input.stampsRequired, sortOrder: 0 } }
              : undefined,
          },
        });
        break;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && i < 20) continue;
        throw err;
      }
    }
    await this.audit.byUser(ctx, 'program.created', { type: 'LoyaltyProgram', id: created.id });
    return this.get(ctx, created.id);
  }

  async update(ctx: TenantContext, id: string, input: z.infer<typeof updateProgramSchema>) {
    const program = await this.load(ctx, id);
    const { design, ...rest } = input;
    if (rest.validFrom && rest.validUntil && rest.validFrom > rest.validUntil) {
      throw new AppError('validation_failed', 'Das Enddatum liegt vor dem Startdatum.', { fields: { validUntil: 'Liegt vor dem Startdatum' } });
    }
    if (design?.logoAssetId) {
      const asset = await this.prisma.asset.findFirst({ where: { id: design.logoAssetId, organizationId: ctx.organizationId }, select: { id: true } });
      if (!asset) throw notFound('Logo');
    }
    const nextDesign = design ? cardDesignSchema.parse({ ...parseDesign(program.design), ...design }) : undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyProgram.update({ where: { id }, data: { ...rest, ...(nextDesign ? { design: nextDesign } : {}) } });
      // Bei Stempelkarten kostet die Hauptprämie immer eine volle Karte.
      if (program.type === 'STAMP' && rest.stampsRequired && rest.stampsRequired !== program.stampsRequired) {
        const main = program.rewards.find((r) => r.sortOrder === 0) ?? program.rewards[0];
        if (main && main.cost === program.stampsRequired) await tx.reward.update({ where: { id: main.id }, data: { cost: rest.stampsRequired } });
      }
    });
    await this.audit.byUser(ctx, 'program.updated', { type: 'LoyaltyProgram', id }, { fields: Object.keys(input) });
    await this.queue.enqueue('wallet.syncProgram', { programId: id });
    return this.get(ctx, id);
  }

  async setStatus(ctx: TenantContext, id: string, status: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED', emailVerified: boolean) {
    const program = await this.load(ctx, id);
    if (status === 'PUBLISHED') {
      if (!emailVerified) throw new AppError('email_not_verified', 'Bitte bestätige zuerst deine E-Mail-Adresse, bevor du eine Karte veröffentlichst.');
      if (!program.rewards.some((r) => r.isActive)) {
        throw new AppError('validation_failed', 'Lege mindestens eine Prämie an, bevor du die Karte veröffentlichst.', { fields: { reward: 'Prämie fehlt' } });
      }
    }
    await this.prisma.loyaltyProgram.update({
      where: { id },
      data: { status, publishedAt: status === 'PUBLISHED' && !program.publishedAt ? new Date() : undefined },
    });
    await this.audit.byUser(ctx, `program.${status.toLowerCase()}`, { type: 'LoyaltyProgram', id });
    return this.get(ctx, id);
  }

  async addReward(ctx: TenantContext, programId: string, input: RewardInput) {
    const program = await this.load(ctx, programId);
    if (program.rewards.filter((r) => r.isActive).length >= 10) throw new AppError('limit_reached', 'Pro Programm sind höchstens 10 Prämien möglich.');
    const reward = await this.prisma.reward.create({
      data: { ...input, organizationId: ctx.organizationId, programId, sortOrder: program.rewards.length },
    });
    await this.audit.byUser(ctx, 'reward.created', { type: 'Reward', id: reward.id });
    await this.queue.enqueue('wallet.syncProgram', { programId });
    return reward;
  }

  async updateReward(ctx: TenantContext, programId: string, rewardId: string, input: Partial<RewardInput>) {
    const reward = await this.prisma.reward.findFirst({ where: { id: rewardId, programId, organizationId: ctx.organizationId } });
    if (!reward) throw notFound('Prämie');
    const updated = await this.prisma.reward.update({ where: { id: rewardId }, data: input });
    await this.audit.byUser(ctx, 'reward.updated', { type: 'Reward', id: rewardId });
    await this.queue.enqueue('wallet.syncProgram', { programId });
    return updated;
  }

  async removeReward(ctx: TenantContext, programId: string, rewardId: string): Promise<void> {
    const program = await this.load(ctx, programId);
    const reward = program.rewards.find((r) => r.id === rewardId);
    if (!reward) throw notFound('Prämie');
    if (program.status === 'PUBLISHED' && program.rewards.filter((r) => r.isActive && r.id !== rewardId).length === 0) {
      throw new AppError('conflict', 'Ein veröffentlichtes Programm braucht mindestens eine Prämie.');
    }
    // Prämien mit Einlösungen bleiben für die Historie erhalten und werden nur deaktiviert.
    const used = await this.prisma.rewardRedemption.count({ where: { rewardId } });
    if (used > 0) await this.prisma.reward.update({ where: { id: rewardId }, data: { isActive: false } });
    else await this.prisma.reward.delete({ where: { id: rewardId } });
    await this.audit.byUser(ctx, 'reward.removed', { type: 'Reward', id: rewardId });
  }
}
