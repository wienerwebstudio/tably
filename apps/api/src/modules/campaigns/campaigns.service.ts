import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { z } from 'zod';
import type { Campaign } from '@tably/database';
import { campaignConfigSchema, segmentSchema, type campaignInputSchema, type Segment } from '@tably/types';
import { ENV, type Env } from '../../common/env';
import { Prisma, PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { MailService } from '../../common/mail.service';
import { QueueService } from '../../common/queue.service';
import { AppError, notFound } from '../../common/errors';
import { addDays, localDay } from '../../common/util';
import type { TenantContext } from '../../common/auth.types';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';

type Input = z.infer<typeof campaignInputSchema>;
const AUTOMATIONS = ['BIRTHDAY', 'INACTIVITY', 'BONUS_STAMPS'];
const HOUR = 3_600_000;

interface Recipient {
  id: string;
  firstName: string;
  email: string | null;
  emailConsent: boolean;
  walletConsent: boolean;
  cardId: string | null;
  hasWallet: boolean;
}

@Injectable()
export class CampaignsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly mail: MailService,
    private readonly queue: QueueService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.queue.register('campaign.send', (p: { campaignId: string }) => this.send(p.campaignId));
    this.queue.registerRecurring('campaign.tick', HOUR, () => this.tick());
  }

  private segmentWhere(organizationId: string, segment: Segment): Prisma.CustomerWhereInput {
    const and: Prisma.CustomerWhereInput[] = [];
    const now = new Date();
    if (segment.programId) and.push({ cards: { some: { programId: segment.programId } } });
    if (segment.inactiveDays) {
      const before = addDays(now, -segment.inactiveDays);
      and.push({ OR: [{ lastActivityAt: { lt: before } }, { lastActivityAt: null, createdAt: { lt: before } }] });
    }
    if (segment.activeDays) and.push({ lastActivityAt: { gte: addDays(now, -segment.activeDays) } });
    if (segment.minBalance !== null) and.push({ cards: { some: { balance: { gte: segment.minBalance }, ...(segment.programId ? { programId: segment.programId } : {}) } } });
    return { organizationId, status: 'ACTIVE', AND: and };
  }

  /** Empfänger einer Zielgruppe inklusive aktuellem Einwilligungsstand. */
  private async recipients(organizationId: string, segment: Segment, onlyIds?: string[]): Promise<Recipient[]> {
    const customers = await this.prisma.customer.findMany({
      where: { ...this.segmentWhere(organizationId, segment), ...(onlyIds ? { id: { in: onlyIds } } : {}) },
      select: {
        id: true,
        firstName: true,
        email: true,
        cards: { select: { id: true, balance: true, programId: true, walletPasses: { select: { id: true } }, program: { select: { rewards: { where: { isActive: true }, select: { cost: true } } } } } },
      },
    });
    if (customers.length === 0) return [];
    const consents = await this.prisma.$queryRaw<Array<{ customerId: string; type: string; granted: boolean }>>`
      SELECT DISTINCT ON ("customerId", type) "customerId", type::text AS type, granted
      FROM "ConsentRecord" WHERE "organizationId" = ${organizationId} AND "customerId" = ANY(${customers.map((c) => c.id)})
      ORDER BY "customerId", type, "createdAt" DESC`;
    const granted = new Set(consents.filter((c) => c.granted).map((c) => `${c.customerId}:${c.type}`));
    return customers
      .filter((c) => {
        if (!segment.rewardReady) return true;
        return c.cards.some((card) => {
          const min = Math.min(...card.program.rewards.map((r) => r.cost), Infinity);
          return card.balance >= min;
        });
      })
      .map((c) => {
        const card = (segment.programId ? c.cards.find((x) => x.programId === segment.programId) : c.cards[0]) ?? null;
        return {
          id: c.id,
          firstName: c.firstName,
          email: c.email,
          emailConsent: granted.has(`${c.id}:MARKETING_EMAIL`),
          walletConsent: granted.has(`${c.id}:MARKETING_WALLET`),
          cardId: card?.id ?? null,
          hasWallet: c.cards.some((x) => x.walletPasses.length > 0),
        };
      });
  }

  async audience(ctx: TenantContext, segment: Segment) {
    const list = await this.recipients(ctx.organizationId, segment);
    return {
      total: list.length,
      emailReachable: list.filter((r) => r.email && r.emailConsent).length,
      walletReachable: list.filter((r) => r.hasWallet && r.walletConsent).length,
    };
  }

  private async assertAllowed(ctx: TenantContext, input: Pick<Input, 'type' | 'channels' | 'programId'>): Promise<void> {
    if (input.channels.includes('EMAIL')) await this.entitlements.assertFeature(ctx.organizationId, 'emailCampaigns', 'E-Mail-Kampagnen');
    if (['BIRTHDAY', 'INACTIVITY'].includes(input.type)) await this.entitlements.assertFeature(ctx.organizationId, 'automations', 'Automatische Kampagnen');
    if (input.programId) {
      const program = await this.prisma.loyaltyProgram.findFirst({ where: { id: input.programId, organizationId: ctx.organizationId }, select: { id: true } });
      if (!program) throw notFound('Treueprogramm');
    }
  }

  private validateContent(input: Input): void {
    const needsText = input.type !== 'BONUS_STAMPS' || input.channels.some((c) => c !== 'CARD');
    if (needsText && !input.subject) throw new AppError('validation_failed', 'Bitte gib einen Betreff bzw. Titel an.', { fields: { subject: 'Erforderlich' } });
    if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) throw new AppError('validation_failed', 'Das Enddatum liegt vor dem Startdatum.', { fields: { endsAt: 'Liegt vor dem Start' } });
  }

  private async load(ctx: TenantContext, id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!campaign) throw notFound('Kampagne');
    return campaign;
  }

  async list(ctx: TenantContext) {
    const campaigns = await this.prisma.campaign.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const stats = await this.prisma.notification.groupBy({ by: ['campaignId', 'status'], where: { organizationId: ctx.organizationId, campaignId: { in: campaigns.map((c) => c.id) }, channel: { not: 'AUTOMATION' } }, _count: { _all: true } });
    return campaigns.map((c) => ({ ...c, stats: this.statsFor(stats, c.id) }));
  }

  private statsFor(rows: Array<{ campaignId: string | null; status: string; _count: { _all: number } }>, id: string) {
    const mine = rows.filter((r) => r.campaignId === id);
    const count = (...statuses: string[]) => mine.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + r._count._all, 0);
    return { sent: count('SENT'), sentTest: count('SENT_TEST'), failed: count('FAILED'), skipped: count('SKIPPED') };
  }

  async get(ctx: TenantContext, id: string) {
    const campaign = await this.load(ctx, id);
    const [stats, notifications] = await Promise.all([
      this.prisma.notification.groupBy({ by: ['campaignId', 'status'], where: { campaignId: id, channel: { not: 'AUTOMATION' } }, _count: { _all: true } }),
      this.prisma.notification.findMany({
        where: { campaignId: id, channel: { not: 'AUTOMATION' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, channel: true, status: true, recipient: true, error: true, createdAt: true, sentAt: true, customer: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { ...campaign, stats: this.statsFor(stats, id), notifications, mailMode: this.mail.mode };
  }

  async create(ctx: TenantContext, input: Input) {
    await this.entitlements.assertLimit(ctx.organizationId, 'campaignsPerMonth', 'Kampagnen pro Monat');
    await this.assertAllowed(ctx, input);
    this.validateContent(input);
    const campaign = await this.prisma.campaign.create({
      data: {
        organizationId: ctx.organizationId,
        programId: input.programId ?? null,
        name: input.name,
        type: input.type,
        channels: input.channels,
        subject: input.subject,
        body: input.body,
        segment: segmentSchema.parse(input.segment ?? {}),
        config: campaignConfigSchema.parse(input.config ?? {}),
        scheduledAt: input.scheduledAt ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdById: ctx.userId,
      },
    });
    await this.audit.byUser(ctx, 'campaign.created', { type: 'Campaign', id: campaign.id }, { type: input.type });
    return this.get(ctx, campaign.id);
  }

  async update(ctx: TenantContext, id: string, input: Input) {
    const campaign = await this.load(ctx, id);
    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) throw new AppError('conflict', 'Diese Kampagne kann nicht mehr bearbeitet werden.');
    if (input.type !== campaign.type) throw new AppError('conflict', 'Der Kampagnentyp kann nicht geändert werden.');
    await this.assertAllowed(ctx, input);
    this.validateContent(input);
    await this.prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        programId: input.programId ?? null,
        channels: input.channels,
        subject: input.subject,
        body: input.body,
        segment: segmentSchema.parse(input.segment ?? {}),
        config: campaignConfigSchema.parse(input.config ?? {}),
        scheduledAt: input.scheduledAt ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
    });
    await this.audit.byUser(ctx, 'campaign.updated', { type: 'Campaign', id });
    return this.get(ctx, id);
  }

  async remove(ctx: TenantContext, id: string): Promise<void> {
    const campaign = await this.load(ctx, id);
    if (campaign.status !== 'DRAFT') throw new AppError('conflict', 'Nur Entwürfe können gelöscht werden.');
    await this.prisma.campaign.delete({ where: { id } });
    await this.audit.byUser(ctx, 'campaign.deleted', { type: 'Campaign', id });
  }

  /** Startet eine Kampagne: sofort senden, einplanen oder Automation aktivieren. */
  async launch(ctx: TenantContext, id: string, emailVerified: boolean) {
    const campaign = await this.load(ctx, id);
    if (!emailVerified) throw new AppError('email_not_verified', 'Bitte bestätige zuerst deine E-Mail-Adresse, bevor du Kampagnen startest.');
    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) throw new AppError('conflict', 'Diese Kampagne läuft bereits oder ist abgeschlossen.');
    await this.assertAllowed(ctx, { type: campaign.type, channels: campaign.channels as Input['channels'], programId: campaign.programId });
    if (AUTOMATIONS.includes(campaign.type)) {
      await this.prisma.campaign.update({ where: { id }, data: { status: 'ACTIVE', startsAt: campaign.startsAt ?? new Date() } });
    } else if (campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now() + 30_000) {
      await this.prisma.campaign.update({ where: { id }, data: { status: 'SCHEDULED' } });
      await this.queue.enqueue('campaign.send', { campaignId: id }, { delayMs: campaign.scheduledAt.getTime() - Date.now(), jobId: `campaign-${id}-${campaign.scheduledAt.getTime()}` });
    } else {
      await this.prisma.campaign.update({ where: { id }, data: { status: 'SCHEDULED', scheduledAt: new Date() } });
      await this.queue.enqueue('campaign.send', { campaignId: id });
    }
    await this.audit.byUser(ctx, 'campaign.launched', { type: 'Campaign', id });
    return this.get(ctx, id);
  }

  async setPaused(ctx: TenantContext, id: string, paused: boolean) {
    const campaign = await this.load(ctx, id);
    const from = paused ? ['ACTIVE', 'SCHEDULED'] : ['PAUSED'];
    if (!from.includes(campaign.status)) throw new AppError('conflict', 'Dieser Statuswechsel ist nicht möglich.');
    const next = paused ? 'PAUSED' : AUTOMATIONS.includes(campaign.type) ? 'ACTIVE' : 'DRAFT';
    await this.prisma.campaign.update({ where: { id }, data: { status: next } });
    await this.audit.byUser(ctx, paused ? 'campaign.paused' : 'campaign.resumed', { type: 'Campaign', id });
    return this.get(ctx, id);
  }

  async end(ctx: TenantContext, id: string) {
    const campaign = await this.load(ctx, id);
    if (!['ACTIVE', 'PAUSED', 'SENT'].includes(campaign.status)) throw new AppError('conflict', 'Diese Kampagne kann nicht beendet werden.');
    await this.prisma.campaign.update({ where: { id }, data: { status: 'ENDED', endsAt: new Date() } });
    await this.audit.byUser(ctx, 'campaign.ended', { type: 'Campaign', id });
    return this.get(ctx, id);
  }

  // ── Versand ───────────────────────────────────────────────────────────
  private footer(orgName: string): string {
    return `\n\n—\nDu erhältst diese Nachricht, weil du bei ${orgName} dem Erhalt von Neuigkeiten zugestimmt hast. Abmelden: ${this.env.WEB_URL}/karten`;
  }

  private async deliver(campaign: Campaign, orgName: string, recipient: Recipient, keySuffix: string): Promise<void> {
    const text = campaign.body.replace(/\{\{\s*vorname\s*\}\}/gi, recipient.firstName);
    const base = { organizationId: campaign.organizationId, campaignId: campaign.id, customerId: recipient.id };
    const skip = (channel: string, reason: string) =>
      this.prisma.notification
        .create({ data: { ...base, channel, status: 'SKIPPED', error: reason, subject: campaign.subject, dedupeKey: `${campaign.id}:${recipient.id}:${channel}:${keySuffix}` } })
        .catch(() => undefined);

    if (campaign.channels.includes('EMAIL')) {
      if (!recipient.email) await skip('EMAIL', 'no_email');
      else if (!recipient.emailConsent) await skip('EMAIL', 'no_consent');
      else {
        await this.mail.send({ ...base, to: recipient.email, kind: `campaign.${campaign.type.toLowerCase()}`, subject: campaign.subject, text: `${text}${this.footer(orgName)}`, dedupeKey: `${campaign.id}:${recipient.id}:EMAIL:${keySuffix}` });
      }
    }
    if (campaign.channels.includes('WALLET')) {
      const configured = Boolean(this.wallet.appleConfig() || this.wallet.googleConfig());
      if (!recipient.hasWallet) await skip('WALLET', 'no_wallet_pass');
      else if (!recipient.walletConsent) await skip('WALLET', 'no_consent');
      else if (!configured) await skip('WALLET', 'wallet_not_configured');
      else {
        try {
          await this.prisma.notification.create({
            data: { ...base, channel: 'WALLET', status: 'SENT', provider: 'wallet-update', subject: campaign.subject, body: text, sentAt: new Date(), dedupeKey: `${campaign.id}:${recipient.id}:WALLET:${keySuffix}` },
          });
          // Die Nachricht steht im Pass; eine neue Version löst die Aktualisierung auf dem Gerät aus.
          await this.prisma.loyaltyCard.updateMany({ where: { customerId: recipient.id, walletPasses: { some: {} } }, data: { version: { increment: 1 } } });
          const cards = await this.prisma.loyaltyCard.findMany({ where: { customerId: recipient.id, walletPasses: { some: {} } }, select: { id: true } });
          for (const card of cards) await this.queue.enqueue('wallet.sync', { cardId: card.id });
        } catch (err) {
          if ((err as { code?: string }).code !== 'P2002') throw err;
        }
      }
    }
  }

  /** Einmaliger Versand einer Ankündigung oder eines Angebots. */
  async send(campaignId: string): Promise<void> {
    const claimed = await this.prisma.campaign.updateMany({ where: { id: campaignId, status: 'SCHEDULED', OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date(Date.now() + 30_000) } }] }, data: { status: 'SENDING' } });
    if (claimed.count === 0) return; // pausiert, bereits gesendet oder noch nicht fällig
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { organization: { select: { name: true } } } });
    try {
      const recipients = await this.recipients(campaign.organizationId, segmentSchema.parse(campaign.segment));
      for (const recipient of recipients) await this.deliver(campaign, campaign.organization.name, recipient, 'once');
      await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENT', sentAt: new Date(), startsAt: campaign.startsAt ?? new Date() } });
    } catch (err) {
      await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } });
      throw err;
    }
  }

  /** Stündlicher Lauf: fällige Sendungen, Geburtstage, Inaktivität, abgelaufene Aktionen. */
  async tick(now: Date = new Date()): Promise<void> {
    const due = await this.prisma.campaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } });
    for (const c of due) await this.send(c.id);

    await this.prisma.campaign.updateMany({ where: { status: { in: ['ACTIVE', 'SENT'] }, endsAt: { lt: now } }, data: { status: 'ENDED' } });

    const automations = await this.prisma.campaign.findMany({
      where: { status: 'ACTIVE', type: { in: ['BIRTHDAY', 'INACTIVITY'] }, OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      include: { organization: { select: { name: true, timezone: true, status: true } } },
    });
    for (const campaign of automations) {
      if (campaign.organization.status !== 'ACTIVE') continue;
      const eff = await this.entitlements.get(campaign.organizationId);
      if (!eff.writable || !eff.features.automations) continue;
      const config = campaignConfigSchema.parse(campaign.config);
      const segment = segmentSchema.parse(campaign.segment);
      let targets: Array<{ id: string; key: string }> = [];

      if (campaign.type === 'BIRTHDAY') {
        const today = localDay(now, campaign.organization.timezone);
        const [, month, day] = today.split('-').map(Number);
        const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Customer" WHERE "organizationId" = ${campaign.organizationId} AND status = 'ACTIVE' AND birthday IS NOT NULL
            AND EXTRACT(MONTH FROM birthday) = ${month} AND EXTRACT(DAY FROM birthday) = ${day}`;
        targets = rows.map((r) => ({ id: r.id, key: today.slice(0, 4) }));
      } else {
        const before = addDays(now, -config.inactivityDays);
        const rows = await this.prisma.customer.findMany({
          where: { organizationId: campaign.organizationId, status: 'ACTIVE', lastActivityAt: { lt: before, gt: addDays(before, -config.inactivityDays) } },
          select: { id: true, lastActivityAt: true },
        });
        // Schlüssel = letzter Besuch → pro Inaktivitätsphase genau eine Nachricht
        targets = rows.map((r) => ({ id: r.id, key: r.lastActivityAt!.toISOString().slice(0, 10) }));
      }
      if (targets.length === 0) continue;
      const recipients = await this.recipients(campaign.organizationId, { ...segment, inactiveDays: null, activeDays: null }, targets.map((t) => t.id));
      for (const recipient of recipients) {
        const key = targets.find((t) => t.id === recipient.id)!.key;
        const marker = `${campaign.id}:${recipient.id}:RUN:${key}`;
        try {
          await this.prisma.notification.create({ data: { organizationId: campaign.organizationId, campaignId: campaign.id, customerId: recipient.id, channel: 'AUTOMATION', status: 'SENT', provider: 'automation', subject: campaign.subject, dedupeKey: marker, sentAt: now } });
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') continue; // für diesen Anlass bereits verarbeitet
          throw err;
        }
        if (config.bonusStamps > 0 && recipient.cardId) {
          await this.ledger
            .earn({ organizationId: campaign.organizationId, cardId: recipient.cardId, amount: config.bonusStamps, source: 'CAMPAIGN', idempotencyKey: `campaign:${marker}`, enforceLimits: false, applyMultiplier: false, note: campaign.name })
            .catch(() => undefined);
        }
        await this.deliver(campaign, campaign.organization.name, recipient, key);
      }
    }
  }
}
