import { Injectable } from '@nestjs/common';
import type { BookingPolicy, LoyaltyProgram, NfcDevice, PosEvent, TapEvent } from '@tably/database';
import { verifySun } from '@tably/nfc';
import { TAP_TTL_SECONDS } from '@tably/config';
import type { ErrorCode } from '@tably/types';
import { PrismaService, isUniqueViolation } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { SessionService } from '../../common/session.service';
import { AppError, notFound } from '../../common/errors';
import { decryptSecret, hashToken, randomToken } from '../../common/crypto';
import type { TenantContext } from '../../common/auth.types';
import { LedgerService } from '../ledger/ledger.service';
import { CardsService } from '../cards/cards.service';
import { DevicesService } from './devices.service';

/**
 * Zählerstände dürfen in leicht vertauschter Reihenfolge eintreffen: der Chip
 * zählt bereits beim Lesen hoch, auch wenn die URL nie oder erst später geöffnet
 * wird. Jeder Zählerstand ist trotzdem nur ein einziges Mal gültig.
 */
const COUNTER_REORDER_WINDOW = 5;
const REJECTED_TAPS_WARNING = 20;
const DEVICE_VELOCITY_WINDOW_MIN = 10;
const DEVICE_VELOCITY_THRESHOLD = 40;
const POS_MATCH_WINDOW_MIN = 10;

export type TapOutcome =
  | 'completed'
  | 'pending_approval'
  | 'pending_pos'
  | 'rejected'
  | 'needs_enrollment'
  | 'device_activated'
  | 'expired';

export interface TapResult {
  status: TapOutcome;
  tapToken?: string;
  simulated?: boolean;
  /** Gebuchte Anzahl (nur bei completed) */
  amount?: number;
  card?: { id: string; balance: number; stampsRequired: number; rewardReady: boolean; shortCode: string };
  program?: ReturnType<CardsService['programView']>;
  /** Fehlercode und Text bei Ablehnung */
  code?: ErrorCode;
  message?: string;
  expiresAt?: Date;
}

interface SubmitInput {
  publicId: string;
  e: string;
  c: string;
  browserTokenHash: string | null;
  ip: string | null;
}

@Injectable()
export class TapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly cards: CardsService,
    private readonly devices: DevicesService,
    private readonly sessions: SessionService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
  ) {}

  private invalid(): AppError {
    // Absichtlich unspezifisch: verrät nicht, ob Gerät, Schlüssel oder MAC falsch waren.
    return new AppError('tap_invalid', 'Dieser Tap konnte nicht bestätigt werden. Bitte halte den Stempel erneut an dein Smartphone.');
  }

  private async reject(device: NfcDevice, type: string, detail: Record<string, unknown>, ip: string | null): Promise<void> {
    const updated = await this.prisma.nfcDevice.update({ where: { id: device.id }, data: { rejectedTaps: { increment: 1 } }, select: { rejectedTaps: true, securityStatus: true } });
    if (updated.rejectedTaps >= REJECTED_TAPS_WARNING && updated.securityStatus === 'OK') {
      await this.prisma.nfcDevice.update({ where: { id: device.id }, data: { securityStatus: 'WARNING' } });
      await this.audit.log({ organizationId: device.organizationId, actorType: 'SYSTEM', action: 'device.security_warning', targetType: 'NfcDevice', targetId: device.id, metadata: { reason: 'rejected_taps' } });
    }
    await this.devices.logEvent(device, type, detail, ip);
  }

  /** Verarbeitet eine vom Chip gelieferte URL. */
  async submit(input: SubmitInput): Promise<TapResult> {
    const device = await this.prisma.nfcDevice.findUnique({ where: { publicId: input.publicId } });
    if (!device || device.kind === 'ACTIVE_READER' || !device.metaKeyEnc || !device.fileKeyEnc) throw this.invalid();
    if (['DISABLED', 'LOST', 'RETIRED'].includes(device.status)) {
      await this.reject(device, 'TAP_REJECTED', { reason: `device_${device.status.toLowerCase()}` }, input.ip);
      throw new AppError('device_inactive', 'Dieser Stempel ist nicht aktiv. Bitte sprich das Team an.');
    }

    const sun = verifySun({ metaKey: decryptSecret(device.metaKeyEnc), fileKey: decryptSecret(device.fileKeyEnc), piccDataHex: input.e, macHex: input.c });
    if (!sun.ok) {
      await this.reject(device, 'MAC_INVALID', { reason: sun.reason }, input.ip);
      throw this.invalid();
    }
    const simulated = device.kind === 'SIMULATED';

    // Erster gültiger Tap eines physischen Stempels bindet die Chip-UID und aktiviert das Gerät.
    if (!device.uidHex) {
      const bound = await this.prisma.nfcDevice.updateMany({
        where: { id: device.id, uidHex: null },
        data: { uidHex: sun.uidHex, status: 'ACTIVE', activatedAt: new Date(), lastCounter: sun.counter, lastUsedAt: new Date() },
      });
      if (bound.count === 1) {
        await this.devices.logEvent(device, 'ACTIVATED', { uid: sun.uidHex, counter: sun.counter }, input.ip);
        await this.audit.log({ organizationId: device.organizationId, actorType: 'DEVICE', actorId: device.id, action: 'device.activated', targetType: 'NfcDevice', targetId: device.id });
        return { status: 'device_activated' };
      }
    } else if (device.uidHex !== sun.uidHex) {
      // Schlüssel passen, aber die UID gehört zu einem anderen Chip → Schlüssel wurden kopiert.
      await this.prisma.nfcDevice.update({ where: { id: device.id }, data: { securityStatus: 'COMPROMISED' } });
      await this.reject(device, 'UID_MISMATCH', { uid: sun.uidHex }, input.ip);
      await this.audit.log({ organizationId: device.organizationId, actorType: 'SYSTEM', action: 'device.compromised', targetType: 'NfcDevice', targetId: device.id, metadata: { reason: 'uid_mismatch' } });
      throw this.invalid();
    }
    if (device.securityStatus === 'COMPROMISED') {
      await this.reject(device, 'TAP_REJECTED', { reason: 'compromised' }, input.ip);
      throw new AppError('device_inactive', 'Dieser Stempel ist gesperrt. Bitte sprich das Team an.');
    }
    if (!device.programId) throw new AppError('device_unassigned', 'Diesem Stempel ist noch kein Treueprogramm zugeordnet.');

    const browserCustomerId = await this.sessions.customerFor(input.browserTokenHash, device.organizationId);

    // Replay-Schutz Teil 1: Zählerstand deutlich hinter dem höchsten bekannten Stand
    if (sun.counter <= device.lastCounter - COUNTER_REORDER_WINDOW) {
      await this.reject(device, 'REPLAY', { counter: sun.counter, lastCounter: device.lastCounter }, input.ip);
      throw new AppError('tap_replayed', 'Dieser Tap wurde bereits verwendet. Bitte halte den Stempel erneut an dein Smartphone.');
    }

    const program = await this.prisma.loyaltyProgram.findUnique({ where: { id: device.programId }, include: { rewards: true, organization: true } });
    if (!program) throw new AppError('device_unassigned', 'Diesem Stempel ist noch kein Treueprogramm zugeordnet.');

    // Replay-Schutz Teil 2: (deviceId, counter) ist eindeutig – genau eine Anfrage gewinnt.
    const tapToken = randomToken();
    let tap: TapEvent;
    try {
      tap = await this.prisma.tapEvent.create({
        data: {
          organizationId: device.organizationId,
          deviceId: device.id,
          programId: program.id,
          counter: sun.counter,
          tokenHash: hashToken(tapToken),
          simulated,
          ip: input.ip,
          expiresAt: new Date(Date.now() + TAP_TTL_SECONDS * 1000),
        },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const existing = await this.prisma.tapEvent.findUnique({ where: { deviceId_counter: { deviceId: device.id, counter: sun.counter } } });
      // Neuladen der Seite durch dieselbe Person: bisheriges Ergebnis zeigen statt Fehler.
      if (existing && existing.customerId && existing.customerId === browserCustomerId) return this.describe(existing, undefined);
      await this.reject(device, 'REPLAY', { counter: sun.counter }, input.ip);
      throw new AppError('tap_replayed', 'Dieser Tap wurde bereits verwendet. Bitte halte den Stempel erneut an dein Smartphone.');
    }
    await this.prisma.$executeRaw`UPDATE "NfcDevice" SET "lastCounter" = GREATEST("lastCounter", ${sun.counter}), "lastUsedAt" = now() WHERE id = ${device.id}`;
    await this.devices.logEvent(device, 'TAP_OK', { counter: sun.counter, tapId: tap.id }, input.ip);

    if (program.status !== 'PUBLISHED' || program.organization.status !== 'ACTIVE') {
      return this.finishRejected(tap, tapToken, 'program_not_published', 'Dieses Treueprogramm ist derzeit nicht aktiv.');
    }
    const subscription = await this.entitlements.get(device.organizationId);
    if (!subscription.writable) return this.finishRejected(tap, tapToken, 'program_not_published', 'Dieses Treueprogramm ist derzeit nicht aktiv.');

    const card = browserCustomerId
      ? await this.prisma.loyaltyCard.findUnique({ where: { programId_customerId: { programId: program.id, customerId: browserCustomerId } } })
      : null;
    if (!card) {
      return { status: 'needs_enrollment', tapToken, simulated, expiresAt: tap.expiresAt, program: this.cards.programView(program, program.organization) };
    }
    return this.process(tap, tapToken, { cardId: card.id, customerId: card.customerId }, device, program);
  }

  /** Ordnet einen noch offenen Tap nach der Registrierung einer Karte zu. */
  async claim(tapToken: string, target: { cardId: string; customerId: string; organizationId: string }): Promise<TapResult | null> {
    const tap = await this.prisma.tapEvent.findUnique({ where: { tokenHash: hashToken(tapToken) } });
    if (!tap || tap.organizationId !== target.organizationId || tap.status !== 'VERIFIED' || tap.customerId) return null;
    if (tap.expiresAt < new Date()) {
      await this.prisma.tapEvent.updateMany({ where: { id: tap.id, status: 'VERIFIED' }, data: { status: 'EXPIRED' } });
      return { status: 'expired', tapToken };
    }
    const [device, program] = await Promise.all([
      this.prisma.nfcDevice.findUniqueOrThrow({ where: { id: tap.deviceId } }),
      this.prisma.loyaltyProgram.findUniqueOrThrow({ where: { id: tap.programId } }),
    ]);
    return this.process(tap, tapToken, target, device, program);
  }

  private async finishRejected(tap: TapEvent, tapToken: string | undefined, code: ErrorCode, message: string): Promise<TapResult> {
    await this.prisma.tapEvent.update({ where: { id: tap.id }, data: { status: 'REJECTED', rejectReason: code, completedAt: new Date() } });
    return { status: 'rejected', tapToken, code, message, simulated: tap.simulated };
  }

  private async cardSummary(cardId: string) {
    const card = await this.prisma.loyaltyCard.findUniqueOrThrow({
      where: { id: cardId },
      select: { id: true, balance: true, shortCode: true, program: { select: { stampsRequired: true, rewards: { where: { isActive: true }, select: { cost: true } } } } },
    });
    const minCost = Math.min(...card.program.rewards.map((r) => r.cost), Infinity);
    return { id: card.id, balance: card.balance, stampsRequired: card.program.stampsRequired, shortCode: card.shortCode, rewardReady: card.balance >= minCost };
  }

  private async deviceVelocityFlag(device: NfcDevice): Promise<string | null> {
    const recent = await this.prisma.tapEvent.count({ where: { deviceId: device.id, createdAt: { gte: new Date(Date.now() - DEVICE_VELOCITY_WINDOW_MIN * 60_000) } } });
    if (recent <= DEVICE_VELOCITY_THRESHOLD) return null;
    if (device.securityStatus === 'OK') {
      await this.prisma.nfcDevice.update({ where: { id: device.id }, data: { securityStatus: 'WARNING' } });
      await this.devices.logEvent(device, 'VELOCITY_WARNING', { tapsInWindow: recent, windowMinutes: DEVICE_VELOCITY_WINDOW_MIN });
    }
    return 'device_velocity';
  }

  private stampAmount(program: Pick<LoyaltyProgram, 'type' | 'stampsPerTap'>, posEvent?: PosEvent | null): number {
    if (program.type === 'POINTS' && posEvent?.amountCents) return Math.max(1, Math.floor(posEvent.amountCents / 100) * program.stampsPerTap);
    return program.stampsPerTap;
  }

  /** Bucht einen zugeordneten Tap; Fehler der Geschäftsregeln werden zum Ergebnis „abgelehnt“. */
  private async book(
    tap: TapEvent,
    tapToken: string | undefined,
    target: { cardId: string; customerId: string },
    device: NfcDevice,
    program: Pick<LoyaltyProgram, 'type' | 'stampsPerTap'>,
    opts: { enforceLimits: boolean; staffUserId?: string | null; posEvent?: PosEvent | null },
  ): Promise<TapResult> {
    try {
      const flagReason = await this.deviceVelocityFlag(device);
      const result = await this.ledger.earn({
        organizationId: tap.organizationId,
        cardId: target.cardId,
        amount: this.stampAmount(program, opts.posEvent),
        source: tap.simulated ? 'SIMULATED_TAP' : opts.posEvent ? 'POS' : 'NFC_TAP',
        idempotencyKey: `tap:${tap.id}`,
        deviceId: device.id,
        locationId: device.locationId,
        staffUserId: opts.staffUserId ?? null,
        enforceLimits: opts.enforceLimits,
        flagReason,
      });
      await this.prisma.tapEvent.update({
        where: { id: tap.id },
        data: { status: 'COMPLETED', customerId: target.customerId, cardId: target.cardId, transactionId: result.transaction.id, completedAt: new Date(), decidedById: opts.staffUserId ?? null },
      });
      return { status: 'completed', tapToken, simulated: tap.simulated, amount: result.transaction.amount, card: await this.cardSummary(target.cardId) };
    } catch (err) {
      if (!(err instanceof AppError) || err.status >= 500) throw err;
      await this.prisma.tapEvent.update({
        where: { id: tap.id },
        data: { status: 'REJECTED', customerId: target.customerId, cardId: target.cardId, rejectReason: err.code, completedAt: new Date(), decidedById: opts.staffUserId ?? null },
      });
      return { status: 'rejected', tapToken, simulated: tap.simulated, code: err.code, message: err.message, card: await this.cardSummary(target.cardId).catch(() => undefined) };
    }
  }

  private async consumePosEvent(organizationId: string, locationId: string | null, tapId: string): Promise<PosEvent | null> {
    const rows = await this.prisma.$queryRaw<PosEvent[]>`
      UPDATE "PosEvent" SET "consumedAt" = now(), "consumedByTap" = ${tapId}
      WHERE id = (
        SELECT id FROM "PosEvent"
        WHERE "organizationId" = ${organizationId} AND "consumedAt" IS NULL
          AND "occurredAt" >= now() - make_interval(mins => ${POS_MATCH_WINDOW_MIN}::int)
          AND ("locationId" IS NULL OR ${locationId}::text IS NULL OR "locationId" = ${locationId})
        ORDER BY "occurredAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
      ) RETURNING *`;
    return rows[0] ?? null;
  }

  private async process(tap: TapEvent, tapToken: string | undefined, target: { cardId: string; customerId: string }, device: NfcDevice, program: LoyaltyProgram): Promise<TapResult> {
    const policy: BookingPolicy = device.policyOverride ?? program.bookingPolicy;
    if (policy === 'AUTO') return this.book(tap, tapToken, target, device, program, { enforceLimits: true });

    if (policy === 'POS_EVENT') {
      const posEvent = await this.consumePosEvent(tap.organizationId, device.locationId, tap.id);
      if (posEvent) return this.book(tap, tapToken, target, device, program, { enforceLimits: true, posEvent });
      await this.prisma.tapEvent.update({ where: { id: tap.id }, data: { status: 'PENDING_POS', customerId: target.customerId, cardId: target.cardId } });
      return { status: 'pending_pos', tapToken, simulated: tap.simulated, expiresAt: tap.expiresAt, card: await this.cardSummary(target.cardId) };
    }

    await this.prisma.tapEvent.update({ where: { id: tap.id }, data: { status: 'PENDING_APPROVAL', customerId: target.customerId, cardId: target.cardId } });
    return { status: 'pending_approval', tapToken, simulated: tap.simulated, expiresAt: tap.expiresAt, card: await this.cardSummary(target.cardId) };
  }

  private async describe(tap: TapEvent, tapToken: string | undefined): Promise<TapResult> {
    const card = tap.cardId ? await this.cardSummary(tap.cardId).catch(() => undefined) : undefined;
    const base = { tapToken, simulated: tap.simulated, card };
    switch (tap.status) {
      case 'COMPLETED': {
        const transaction = tap.transactionId ? await this.prisma.stampTransaction.findUnique({ where: { id: tap.transactionId }, select: { amount: true } }) : null;
        return { ...base, status: 'completed', amount: transaction?.amount };
      }
      case 'PENDING_APPROVAL':
        return { ...base, status: 'pending_approval', expiresAt: tap.expiresAt };
      case 'PENDING_POS':
        return { ...base, status: 'pending_pos', expiresAt: tap.expiresAt };
      case 'REJECTED':
        return { ...base, status: 'rejected', code: (tap.rejectReason as ErrorCode | null) ?? 'tap_invalid', message: REJECT_MESSAGES[tap.rejectReason ?? ''] ?? 'Der Stempel wurde nicht gutgeschrieben.' };
      case 'EXPIRED':
        return { ...base, status: 'expired' };
      default:
        return { ...base, status: 'needs_enrollment', expiresAt: tap.expiresAt };
    }
  }

  /** Status eines Taps (Polling durch die Kundenseite). */
  async status(tapToken: string): Promise<TapResult> {
    let tap = await this.prisma.tapEvent.findUnique({ where: { tokenHash: hashToken(tapToken) } });
    if (!tap) throw notFound('Tap');
    if (['VERIFIED', 'PENDING_APPROVAL', 'PENDING_POS'].includes(tap.status) && tap.expiresAt < new Date()) {
      await this.prisma.tapEvent.updateMany({ where: { id: tap.id, status: tap.status }, data: { status: 'EXPIRED' } });
      tap = await this.prisma.tapEvent.findUniqueOrThrow({ where: { id: tap.id } });
    }
    return this.describe(tap, tapToken);
  }

  // ── Freigabe durch Mitarbeitende ──────────────────────────────────────
  async pending(ctx: TenantContext) {
    const taps = await this.prisma.tapEvent.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ['PENDING_APPROVAL', 'PENDING_POS'] }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      include: { device: { select: { name: true, location: { select: { name: true } } } } },
    });
    const cards = await this.prisma.loyaltyCard.findMany({
      where: { id: { in: taps.map((t) => t.cardId).filter((x): x is string => Boolean(x)) } },
      select: { id: true, balance: true, shortCode: true, lastStampAt: true, customer: { select: { firstName: true, lastName: true } }, program: { select: { name: true, stampsRequired: true } } },
    });
    return taps.map((t) => {
      const card = cards.find((c) => c.id === t.cardId);
      return {
        id: t.id,
        status: t.status,
        simulated: t.simulated,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        deviceName: t.device.name,
        locationName: t.device.location?.name ?? null,
        card: card ? { id: card.id, shortCode: card.shortCode, balance: card.balance, lastStampAt: card.lastStampAt, programName: card.program.name, stampsRequired: card.program.stampsRequired } : null,
        customerName: card ? [card.customer.firstName, card.customer.lastName].filter(Boolean).join(' ') : null,
      };
    });
  }

  async decide(ctx: TenantContext, tapId: string, decision: 'APPROVE' | 'REJECT'): Promise<TapResult> {
    // Atomarer Statuswechsel: nur eine Entscheidung gewinnt.
    const claimed = await this.prisma.tapEvent.updateMany({
      where: { id: tapId, organizationId: ctx.organizationId, status: { in: ['PENDING_APPROVAL', 'PENDING_POS'] }, expiresAt: { gt: new Date() } },
      data: { status: 'VERIFIED', decidedById: ctx.userId },
    });
    if (claimed.count === 0) throw new AppError('tap_already_used', 'Dieser Tap wurde bereits bearbeitet oder ist abgelaufen.');
    const tap = await this.prisma.tapEvent.findUniqueOrThrow({ where: { id: tapId } });
    if (!tap.cardId || !tap.customerId) throw new AppError('internal_error', 'Tap ohne Karte.');
    if (decision === 'REJECT') {
      await this.prisma.tapEvent.update({ where: { id: tap.id }, data: { status: 'REJECTED', rejectReason: 'forbidden', completedAt: new Date() } });
      await this.audit.byUser(ctx, 'tap.rejected', { type: 'TapEvent', id: tap.id });
      return { status: 'rejected', code: 'forbidden', message: REJECT_MESSAGES.forbidden };
    }
    const [device, program] = await Promise.all([
      this.prisma.nfcDevice.findUniqueOrThrow({ where: { id: tap.deviceId } }),
      this.prisma.loyaltyProgram.findUniqueOrThrow({ where: { id: tap.programId } }),
    ]);
    const result = await this.book(tap, undefined, { cardId: tap.cardId, customerId: tap.customerId }, device, program, { enforceLimits: false, staffUserId: ctx.userId });
    await this.audit.byUser(ctx, 'tap.approved', { type: 'TapEvent', id: tap.id }, { outcome: result.status });
    return result;
  }

  // ── Kassen-Ereignisse ─────────────────────────────────────────────────
  async ingestPosEvent(organizationId: string, input: { externalId: string; locationId?: string | null; amountCents?: number | null; currency?: string | null; occurredAt?: Date }) {
    if (input.locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: input.locationId, organizationId }, select: { id: true } });
      if (!location) throw notFound('Standort');
    }
    let event: PosEvent;
    let duplicate = false;
    try {
      event = await this.prisma.posEvent.create({
        data: { organizationId, externalId: input.externalId, locationId: input.locationId ?? null, amountCents: input.amountCents ?? null, currency: input.currency ?? null, occurredAt: input.occurredAt ?? new Date() },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      event = await this.prisma.posEvent.findUniqueOrThrow({ where: { organizationId_externalId: { organizationId, externalId: input.externalId } } });
      duplicate = true;
    }
    let matchedTapId: string | null = event.consumedByTap;
    if (!duplicate && !event.consumedAt) {
      // Wartet bereits ein Tap auf ein Kassen-Ereignis? Der älteste passende gewinnt.
      const waiting = await this.prisma.tapEvent.findMany({
        where: { organizationId, status: 'PENDING_POS', expiresAt: { gt: new Date() }, ...(input.locationId ? { device: { OR: [{ locationId: input.locationId }, { locationId: null }] } } : {}) },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });
      for (const tap of waiting) {
        const claimed = await this.prisma.tapEvent.updateMany({ where: { id: tap.id, status: 'PENDING_POS' }, data: { status: 'VERIFIED' } });
        if (claimed.count === 0) continue;
        const consumed = await this.prisma.posEvent.updateMany({ where: { id: event.id, consumedAt: null }, data: { consumedAt: new Date(), consumedByTap: tap.id } });
        if (consumed.count === 0) {
          await this.prisma.tapEvent.update({ where: { id: tap.id }, data: { status: 'PENDING_POS' } });
          break;
        }
        const [device, program] = await Promise.all([
          this.prisma.nfcDevice.findUniqueOrThrow({ where: { id: tap.deviceId } }),
          this.prisma.loyaltyProgram.findUniqueOrThrow({ where: { id: tap.programId } }),
        ]);
        await this.book(tap, undefined, { cardId: tap.cardId!, customerId: tap.customerId! }, device, program, { enforceLimits: true, posEvent: event });
        matchedTapId = tap.id;
        break;
      }
    }
    return { id: event.id, externalId: event.externalId, duplicate, matched: Boolean(matchedTapId) };
  }
}

const REJECT_MESSAGES: Record<string, string> = {
  stamp_too_soon: 'Der letzte Stempel ist erst wenige Minuten her.',
  daily_limit_reached: 'Das Tageslimit für diese Karte ist erreicht.',
  card_blocked: 'Diese Karte ist nicht aktiv.',
  customer_blocked: 'Dieses Kundenkonto ist gesperrt.',
  program_not_published: 'Dieses Treueprogramm ist derzeit nicht aktiv.',
  program_expired: 'Dieses Treueprogramm läuft aktuell nicht.',
  forbidden: 'Der Stempel wurde vom Team nicht freigegeben.',
};
