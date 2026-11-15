import { Injectable } from '@nestjs/common';
import type { LoyaltyCard, StampTransaction, TransactionSource } from '@tably/database';
import { campaignConfigSchema } from '@tably/types';
import { REDEMPTION_CODE_TTL_SECONDS } from '@tably/config';
import { Prisma, PrismaService, isUniqueViolation, type Tx } from '../../common/prisma.service';
import { QueueService } from '../../common/queue.service';
import { AppError, notFound } from '../../common/errors';
import { keyedHash, randomDigits } from '../../common/crypto';
import { localWeekday } from '../../common/util';

export interface EarnInput {
  organizationId: string;
  cardId: string;
  /** Basisanzahl vor Aktions-Multiplikator */
  amount: number;
  source: TransactionSource;
  idempotencyKey: string;
  deviceId?: string | null;
  locationId?: string | null;
  staffUserId?: string | null;
  note?: string | null;
  /** Mindestabstand und Tageslimit des Programms durchsetzen */
  enforceLimits: boolean;
  /** Laufende Bonus-Aktionen berücksichtigen */
  applyMultiplier?: boolean;
  flagReason?: string | null;
}

export interface LedgerResult {
  transaction: StampTransaction;
  card: LoyaltyCard;
  /** true, wenn die Anfrage bereits verbucht war (Idempotenz) */
  duplicate: boolean;
}

const LIMITED_SOURCES: TransactionSource[] = ['NFC_TAP', 'SIMULATED_TAP', 'ACTIVE_READER', 'MANUAL', 'POS'];
const MANUAL_VELOCITY_WINDOW_MIN = 60;
const MANUAL_VELOCITY_THRESHOLD = 30;

/**
 * Einzige Stelle, die Kartenstände verändert.
 *
 * Jede Buchung läuft in einer Datenbanktransaktion:
 *   1. Kartenzeile sperren (SELECT … FOR UPDATE) – parallele Buchungen
 *      derselben Karte laufen nacheinander.
 *   2. Idempotency-Key prüfen – eine wiederholte Anfrage liefert die
 *      ursprüngliche Buchung zurück, ohne erneut zu buchen.
 *   3. Geschäftsregeln prüfen.
 *   4. StampTransaction + PointLedger schreiben, Kartenstand fortschreiben.
 * Der Stand auf der Karte ist damit immer gleich der Summe des Ledgers.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  private async lockCard(tx: Tx, organizationId: string, cardId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "LoyaltyCard" WHERE id = ${cardId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    if (rows.length === 0) throw notFound('Karte');
    return tx.loyaltyCard.findUniqueOrThrow({ where: { id: cardId }, include: { program: true, customer: true, organization: { select: { timezone: true } } } });
  }

  private async existing(tx: Tx, organizationId: string, idempotencyKey: string): Promise<StampTransaction | null> {
    return tx.stampTransaction.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } } });
  }

  /** Führt `fn` transaktional aus und behandelt das Rennen zweier Anfragen mit demselben Idempotency-Key. */
  private async run(organizationId: string, idempotencyKey: string, fn: (tx: Tx) => Promise<LedgerResult>): Promise<LedgerResult> {
    let result: LedgerResult;
    try {
      result = await this.prisma.$transaction(fn, { timeout: 15_000 });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const transaction = await this.prisma.stampTransaction.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } } });
      if (!transaction) throw err;
      const card = await this.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: transaction.cardId } });
      return { transaction, card, duplicate: true };
    }
    if (!result.duplicate) await this.afterCommit(result.card.id);
    return result;
  }

  private async afterCommit(cardId: string): Promise<void> {
    await this.queue.enqueue('wallet.sync', { cardId }).catch(() => undefined);
  }

  private async activeMultiplier(tx: Tx, organizationId: string, programId: string, timezone: string): Promise<number> {
    const now = new Date();
    const campaigns = await tx.campaign.findMany({
      where: {
        organizationId,
        type: 'BONUS_STAMPS',
        status: 'ACTIVE',
        OR: [{ programId: null }, { programId }],
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: { config: true },
    });
    let multiplier = 1;
    const weekday = localWeekday(now, timezone);
    for (const campaign of campaigns) {
      const config = campaignConfigSchema.safeParse(campaign.config);
      if (!config.success) continue;
      if (config.data.weekdays.length > 0 && !config.data.weekdays.includes(weekday)) continue;
      multiplier = Math.max(multiplier, config.data.multiplier);
    }
    return multiplier;
  }

  private async write(
    tx: Tx,
    card: LoyaltyCard,
    data: {
      type: StampTransaction['type'];
      source: TransactionSource;
      amount: number;
      idempotencyKey: string;
      deviceId?: string | null;
      locationId?: string | null;
      staffUserId?: string | null;
      note?: string | null;
      flagReason?: string | null;
      reversesId?: string | null;
      countsAsVisit?: boolean;
    },
  ): Promise<{ transaction: StampTransaction; card: LoyaltyCard }> {
    const balanceAfter = card.balance + data.amount;
    if (balanceAfter < 0) throw new AppError('insufficient_balance', 'Der Kartenstand reicht dafür nicht aus.', { details: { balance: card.balance } });
    const transaction = await tx.stampTransaction.create({
      data: {
        organizationId: card.organizationId,
        programId: card.programId,
        cardId: card.id,
        customerId: card.customerId,
        type: data.type,
        source: data.source,
        amount: data.amount,
        idempotencyKey: data.idempotencyKey,
        deviceId: data.deviceId ?? null,
        locationId: data.locationId ?? null,
        staffUserId: data.staffUserId ?? null,
        note: data.note ?? null,
        flagged: Boolean(data.flagReason),
        flagReason: data.flagReason ?? null,
        reversesId: data.reversesId ?? null,
      },
    });
    await tx.pointLedger.create({ data: { organizationId: card.organizationId, cardId: card.id, transactionId: transaction.id, delta: data.amount, balanceAfter } });
    const now = new Date();
    const updated = await tx.loyaltyCard.update({
      where: { id: card.id },
      data: {
        balance: balanceAfter,
        version: { increment: 1 },
        ...(data.type === 'EARN' ? { lifetimeEarned: { increment: data.amount }, lastStampAt: now, ...(data.countsAsVisit ? { visits: { increment: 1 } } : {}) } : {}),
        ...(data.type === 'REDEEM' ? { lifetimeRedeemed: { increment: -data.amount } } : {}),
      },
    });
    await tx.customer.update({ where: { id: card.customerId }, data: { lastActivityAt: now } });
    return { transaction, card: updated };
  }

  async earn(input: EarnInput): Promise<LedgerResult> {
    if (input.amount < 1) throw new AppError('validation_failed', 'Die Anzahl muss mindestens 1 sein.');
    return this.run(input.organizationId, input.idempotencyKey, async (tx) => {
      const card = await this.lockCard(tx, input.organizationId, input.cardId);
      const duplicate = await this.existing(tx, input.organizationId, input.idempotencyKey);
      if (duplicate) return { transaction: duplicate, card, duplicate: true };

      const { program, customer } = card;
      const now = new Date();
      if (customer.status !== 'ACTIVE') throw new AppError('customer_blocked', 'Dieses Kundenkonto ist gesperrt.');
      if (card.status !== 'ACTIVE') throw new AppError('card_blocked', 'Diese Karte ist nicht aktiv.');
      if (card.expiresAt && card.expiresAt < now) {
        await tx.loyaltyCard.update({ where: { id: card.id }, data: { status: 'EXPIRED' } });
        throw new AppError('card_blocked', 'Diese Karte ist abgelaufen.');
      }
      if (program.status !== 'PUBLISHED') throw new AppError('program_not_published', 'Dieses Treueprogramm ist derzeit nicht aktiv.');
      if ((program.validFrom && program.validFrom > now) || (program.validUntil && program.validUntil < now)) {
        throw new AppError('program_expired', 'Dieses Treueprogramm läuft aktuell nicht.');
      }

      let flagReason = input.flagReason ?? null;
      const limited = LIMITED_SOURCES.includes(input.source);
      if (limited) {
        const sinceLast = card.lastStampAt ? (now.getTime() - card.lastStampAt.getTime()) / 60_000 : Infinity;
        const tooSoon = program.minIntervalMinutes > 0 && sinceLast < program.minIntervalMinutes;
        const countRows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM "StampTransaction"
          WHERE "cardId" = ${card.id} AND type = 'EARN'
            AND source::text = ANY(${LIMITED_SOURCES as string[]})
            AND "createdAt" >= (date_trunc('day', now() AT TIME ZONE ${card.organization.timezone}) AT TIME ZONE ${card.organization.timezone})`;
        const overDaily = Number(countRows[0]?.count ?? 0) >= program.maxStampsPerDay;
        if (input.enforceLimits) {
          if (tooSoon) {
            const wait = Math.ceil(program.minIntervalMinutes - sinceLast);
            throw new AppError('stamp_too_soon', `Der letzte Stempel ist erst wenige Minuten her. Nächster Stempel in ${wait} Min.`, { details: { retryAfterMinutes: wait } });
          }
          if (overDaily) throw new AppError('daily_limit_reached', 'Das Tageslimit für diese Karte ist erreicht.', { details: { maxPerDay: program.maxStampsPerDay } });
        } else if (tooSoon || overDaily) {
          // Mitarbeitende dürfen Limits bewusst übersteuern – das wird aber sichtbar markiert.
          flagReason ??= tooSoon ? 'limit_override_interval' : 'limit_override_daily';
        }
      }
      if (input.source === 'MANUAL' && input.staffUserId) {
        const recent = await tx.stampTransaction.count({
          where: { organizationId: input.organizationId, staffUserId: input.staffUserId, source: 'MANUAL', type: 'EARN', createdAt: { gte: new Date(now.getTime() - MANUAL_VELOCITY_WINDOW_MIN * 60_000) } },
        });
        if (recent >= MANUAL_VELOCITY_THRESHOLD) flagReason ??= 'staff_manual_velocity';
      }

      const multiplier = input.applyMultiplier === false ? 1 : await this.activeMultiplier(tx, input.organizationId, program.id, card.organization.timezone);
      const written = await this.write(tx, card, {
        type: 'EARN',
        source: input.source,
        amount: input.amount * multiplier,
        idempotencyKey: input.idempotencyKey,
        deviceId: input.deviceId,
        locationId: input.locationId,
        staffUserId: input.staffUserId,
        note: multiplier > 1 ? `${input.note ? `${input.note} · ` : ''}Aktion ×${multiplier}` : input.note,
        flagReason,
        countsAsVisit: limited,
      });
      // Karten mit Verfallsfrist verlängern sich mit jedem Besuch.
      if (program.cardValidityDays && limited) {
        written.card = await tx.loyaltyCard.update({ where: { id: card.id }, data: { expiresAt: new Date(now.getTime() + program.cardValidityDays * 86_400_000) } });
      }
      return { ...written, duplicate: false };
    });
  }

  /** Manuelle Korrektur (positiv oder negativ) mit Pflichtbegründung. */
  async adjust(input: { organizationId: string; cardId: string; delta: number; note: string; staffUserId: string; idempotencyKey: string }): Promise<LedgerResult> {
    return this.run(input.organizationId, input.idempotencyKey, async (tx) => {
      const card = await this.lockCard(tx, input.organizationId, input.cardId);
      const duplicate = await this.existing(tx, input.organizationId, input.idempotencyKey);
      if (duplicate) return { transaction: duplicate, card, duplicate: true };
      const written = await this.write(tx, card, { type: 'ADJUST', source: 'MANUAL', amount: input.delta, idempotencyKey: input.idempotencyKey, staffUserId: input.staffUserId, note: input.note });
      return { ...written, duplicate: false };
    });
  }

  /** Storniert eine Buchung durch eine Gegenbuchung. Jede Buchung kann nur einmal storniert werden. */
  async reverse(input: { organizationId: string; transactionId: string; staffUserId: string; note?: string | null }): Promise<LedgerResult> {
    const original = await this.prisma.stampTransaction.findFirst({ where: { id: input.transactionId, organizationId: input.organizationId } });
    if (!original) throw notFound('Buchung');
    if (original.type === 'REVERSAL') throw new AppError('conflict', 'Eine Stornobuchung kann nicht storniert werden.');
    const idempotencyKey = `reversal:${original.id}`;
    return this.run(input.organizationId, idempotencyKey, async (tx) => {
      const card = await this.lockCard(tx, input.organizationId, original.cardId);
      const duplicate = await this.existing(tx, input.organizationId, idempotencyKey);
      if (duplicate) throw new AppError('conflict', 'Diese Buchung wurde bereits storniert.');
      const written = await this.write(tx, card, {
        type: 'REVERSAL',
        source: 'MANUAL',
        amount: -original.amount,
        idempotencyKey,
        staffUserId: input.staffUserId,
        note: input.note ?? 'Storno',
        reversesId: original.id,
      });
      if (original.type === 'REDEEM') {
        await tx.rewardRedemption.updateMany({ where: { transactionId: original.id }, data: { status: 'CANCELED' } });
      }
      return { ...written, duplicate: false };
    });
  }

  // ── Prämien ───────────────────────────────────────────────────────────
  private async loadReward(tx: Tx, organizationId: string, programId: string, rewardId: string) {
    const reward = await tx.reward.findFirst({ where: { id: rewardId, organizationId, programId, isActive: true } });
    if (!reward) throw notFound('Prämie');
    return reward;
  }

  /** Einlösung durch Mitarbeitende direkt am Kundenprofil – atomar. */
  async redeemDirect(input: { organizationId: string; cardId: string; rewardId: string; staffUserId: string; locationId?: string | null; idempotencyKey: string }) {
    const result = await this.run(input.organizationId, input.idempotencyKey, async (tx) => {
      const card = await this.lockCard(tx, input.organizationId, input.cardId);
      const duplicate = await this.existing(tx, input.organizationId, input.idempotencyKey);
      if (duplicate) return { transaction: duplicate, card, duplicate: true };
      if (card.status !== 'ACTIVE' || card.customer.status !== 'ACTIVE') throw new AppError('card_blocked', 'Diese Karte ist nicht aktiv.');
      const reward = await this.loadReward(tx, input.organizationId, card.programId, input.rewardId);
      if (card.balance < reward.cost) {
        throw new AppError('insufficient_balance', `Für „${reward.name}“ fehlen noch ${reward.cost - card.balance}.`, { details: { balance: card.balance, cost: reward.cost } });
      }
      const written = await this.write(tx, card, { type: 'REDEEM', source: 'MANUAL', amount: -reward.cost, idempotencyKey: input.idempotencyKey, staffUserId: input.staffUserId, locationId: input.locationId, note: reward.name });
      await tx.rewardRedemption.create({
        data: {
          organizationId: input.organizationId,
          programId: card.programId,
          cardId: card.id,
          customerId: card.customerId,
          rewardId: reward.id,
          rewardName: reward.name,
          cost: reward.cost,
          status: 'COMPLETED',
          staffUserId: input.staffUserId,
          locationId: input.locationId ?? null,
          transactionId: written.transaction.id,
          completedAt: new Date(),
        },
      });
      return { ...written, duplicate: false };
    });
    return result;
  }

  /**
   * Kundenseitig gestartete Einlösung: erzeugt einen kurzlebigen Code.
   * Der Kartenstand ändert sich erst, wenn Mitarbeitende den Code bestätigen.
   */
  async requestRedemption(input: { organizationId: string; cardId: string; rewardId: string }): Promise<{ code: string; expiresAt: Date; rewardName: string; redemptionId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const card = await this.lockCard(tx, input.organizationId, input.cardId);
      if (card.status !== 'ACTIVE' || card.customer.status !== 'ACTIVE') throw new AppError('card_blocked', 'Diese Karte ist nicht aktiv.');
      const reward = await this.loadReward(tx, input.organizationId, card.programId, input.rewardId);
      if (card.balance < reward.cost) throw new AppError('insufficient_balance', `Für „${reward.name}“ fehlen noch ${reward.cost - card.balance}.`);
      // Offene Codes dieser Karte verfallen, damit immer nur einer gültig ist.
      await tx.rewardRedemption.updateMany({ where: { cardId: card.id, status: 'PENDING' }, data: { status: 'CANCELED' } });
      const expiresAt = new Date(Date.now() + REDEMPTION_CODE_TTL_SECONDS * 1000);
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomDigits(6);
        const codeHash = keyedHash(`redeem:${input.organizationId}`, code);
        const clash = await tx.rewardRedemption.findFirst({ where: { organizationId: input.organizationId, codeHash, status: 'PENDING', codeExpiresAt: { gt: new Date() } }, select: { id: true } });
        if (clash) continue;
        const redemption = await tx.rewardRedemption.create({
          data: { organizationId: input.organizationId, programId: card.programId, cardId: card.id, customerId: card.customerId, rewardId: reward.id, rewardName: reward.name, cost: reward.cost, codeHash, codeExpiresAt: expiresAt },
        });
        return { code, expiresAt, rewardName: reward.name, redemptionId: redemption.id };
      }
      throw new AppError('internal_error', 'Es konnte kein Code erzeugt werden. Bitte erneut versuchen.');
    });
  }

  /** Mitarbeitende bestätigen den vom Kunden gezeigten Code – erst jetzt wird abgebucht. */
  async confirmRedemptionCode(input: { organizationId: string; code: string; staffUserId: string; locationId?: string | null }) {
    const codeHash = keyedHash(`redeem:${input.organizationId}`, input.code);
    const pending = await this.prisma.rewardRedemption.findFirst({
      where: { organizationId: input.organizationId, codeHash, status: 'PENDING', codeExpiresAt: { gt: new Date() } },
    });
    if (!pending) throw new AppError('code_invalid', 'Dieser Code ist ungültig oder abgelaufen.');
    const idempotencyKey = `redemption:${pending.id}`;
    const result = await this.run(input.organizationId, idempotencyKey, async (tx) => {
      const card = await this.lockCard(tx, input.organizationId, pending.cardId);
      const redemption = await tx.rewardRedemption.findUniqueOrThrow({ where: { id: pending.id } });
      if (redemption.status !== 'PENDING') throw new AppError('code_invalid', 'Dieser Code wurde bereits verwendet.');
      if (card.status !== 'ACTIVE' || card.customer.status !== 'ACTIVE') throw new AppError('card_blocked', 'Diese Karte ist nicht aktiv.');
      if (card.balance < redemption.cost) throw new AppError('insufficient_balance', 'Der Kartenstand reicht nicht mehr aus.');
      const written = await this.write(tx, card, { type: 'REDEEM', source: 'MANUAL', amount: -redemption.cost, idempotencyKey, staffUserId: input.staffUserId, locationId: input.locationId, note: redemption.rewardName });
      await tx.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: 'COMPLETED', staffUserId: input.staffUserId, locationId: input.locationId ?? null, transactionId: written.transaction.id, completedAt: new Date(), codeHash: null },
      });
      return { ...written, duplicate: false };
    });
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: pending.customerId }, select: { firstName: true, lastName: true } });
    return { ...result, rewardName: pending.rewardName, customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') };
  }

  /** Summe des Ledgers – für Konsistenzprüfungen (Tests, Super-Admin). */
  async ledgerSum(cardId: string): Promise<number> {
    const agg = await this.prisma.pointLedger.aggregate({ where: { cardId }, _sum: { delta: true } });
    return agg._sum.delta ?? 0;
  }
}

export type { Prisma };
