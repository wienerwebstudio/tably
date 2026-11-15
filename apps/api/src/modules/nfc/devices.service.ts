import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import type { NfcDevice } from '@tably/database';
import { buildPersonalizationProfile, buildTapUrl, generateSun, SDM_COUNTER_MAX } from '@tably/nfc';
import type { createDeviceSchema, deviceStatusSchema, updateDeviceSchema } from '@tably/types';
import { ENV, type Env } from '../../common/env';
import { PrismaService, type Prisma } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { AppError, notFound } from '../../common/errors';
import { decryptSecret, encryptSecret, randomId } from '../../common/crypto';
import type { TenantContext } from '../../common/auth.types';

const PUBLIC_FIELDS = {
  id: true,
  publicId: true,
  name: true,
  kind: true,
  status: true,
  securityStatus: true,
  uidHex: true,
  keyVersion: true,
  lastCounter: true,
  policyOverride: true,
  rejectedTaps: true,
  lastUsedAt: true,
  activatedAt: true,
  createdAt: true,
  locationId: true,
  programId: true,
  firmware: true,
  location: { select: { id: true, name: true } },
  program: { select: { id: true, name: true, bookingPolicy: true, status: true } },
} satisfies Prisma.NfcDeviceSelect;

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  logEvent(device: Pick<NfcDevice, 'id' | 'organizationId'>, type: string, detail?: Record<string, unknown>, ip?: string | null) {
    return this.prisma.nfcDeviceEvent
      .create({ data: { organizationId: device.organizationId, deviceId: device.id, type, detail: detail as Prisma.InputJsonValue | undefined, ip: ip ?? null } })
      .catch(() => undefined);
  }

  private async assertRefs(ctx: TenantContext, refs: { locationId?: string | null; programId?: string | null }): Promise<void> {
    if (refs.locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: refs.locationId, organizationId: ctx.organizationId }, select: { id: true } });
      if (!location) throw notFound('Standort');
    }
    if (refs.programId) {
      const program = await this.prisma.loyaltyProgram.findFirst({ where: { id: refs.programId, organizationId: ctx.organizationId, status: { not: 'ARCHIVED' } }, select: { id: true } });
      if (!program) throw notFound('Treueprogramm');
    }
  }

  private async load(ctx: TenantContext, id: string): Promise<NfcDevice> {
    const device = await this.prisma.nfcDevice.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!device) throw notFound('Gerät');
    return device;
  }

  async list(ctx: TenantContext) {
    const devices = await this.prisma.nfcDevice.findMany({ where: { organizationId: ctx.organizationId, status: { not: 'RETIRED' } }, select: PUBLIC_FIELDS, orderBy: { createdAt: 'asc' } });
    const since = new Date(Date.now() - 7 * 86_400_000);
    const counts = await this.prisma.stampTransaction.groupBy({
      by: ['deviceId'],
      where: { organizationId: ctx.organizationId, deviceId: { in: devices.map((d) => d.id) }, type: 'EARN', createdAt: { gte: since } },
      _count: { _all: true },
    });
    const byDevice = new Map(counts.map((c) => [c.deviceId, c._count._all]));
    return devices.map((d) => ({ ...d, stamps7d: byDevice.get(d.id) ?? 0 }));
  }

  async get(ctx: TenantContext, id: string) {
    const device = await this.prisma.nfcDevice.findFirst({ where: { id, organizationId: ctx.organizationId }, select: PUBLIC_FIELDS });
    if (!device) throw notFound('Gerät');
    const [events, taps] = await Promise.all([
      this.prisma.nfcDeviceEvent.findMany({ where: { deviceId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.tapEvent.groupBy({ by: ['status'], where: { deviceId: id, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, _count: { _all: true } }),
    ]);
    return { device, events, taps30d: Object.fromEntries(taps.map((t) => [t.status, t._count._all])), simulatorEnabled: this.env.NFC_SIMULATOR_ENABLED };
  }

  async create(ctx: TenantContext, input: z.infer<typeof createDeviceSchema>) {
    if (input.kind === 'SIMULATED' && !this.env.NFC_SIMULATOR_ENABLED) {
      throw new AppError('simulator_disabled', 'Der Simulationsmodus ist auf diesem System nicht aktiviert.');
    }
    await this.entitlements.assertLimit(ctx.organizationId, 'devices', 'NFC-Stempel');
    await this.assertRefs(ctx, input);
    const simulated = input.kind === 'SIMULATED';
    const device = await this.prisma.nfcDevice.create({
      data: {
        organizationId: ctx.organizationId,
        publicId: randomId('st', 9),
        name: input.name,
        kind: input.kind,
        locationId: input.locationId ?? null,
        programId: input.programId ?? null,
        metaKeyEnc: encryptSecret(randomBytes(16)),
        fileKeyEnc: encryptSecret(randomBytes(16)),
        // Simulierte Stempel haben eine erfundene UID und sind sofort einsatzbereit.
        uidHex: simulated ? `04${randomBytes(6).toString('hex').toUpperCase()}` : null,
        status: simulated ? 'ACTIVE' : 'PENDING',
        activatedAt: simulated ? new Date() : null,
      },
    });
    await this.logEvent(device, 'REGISTERED', { kind: input.kind });
    await this.audit.byUser(ctx, 'device.registered', { type: 'NfcDevice', id: device.id }, { kind: input.kind });
    return this.get(ctx, device.id);
  }

  async update(ctx: TenantContext, id: string, input: z.infer<typeof updateDeviceSchema>) {
    await this.load(ctx, id);
    await this.assertRefs(ctx, input);
    await this.prisma.nfcDevice.update({ where: { id }, data: input });
    await this.audit.byUser(ctx, 'device.updated', { type: 'NfcDevice', id }, { fields: Object.keys(input) });
    return this.get(ctx, id);
  }

  async setStatus(ctx: TenantContext, id: string, input: z.infer<typeof deviceStatusSchema>) {
    const device = await this.load(ctx, id);
    if (device.status === 'RETIRED') throw new AppError('conflict', 'Dieses Gerät wurde außer Betrieb genommen.');
    if (input.status === 'ACTIVE') {
      if (device.status === 'PENDING' || !device.uidHex) {
        throw new AppError('conflict', 'Der Stempel wird durch den ersten gültigen Tap aktiviert. Halte ihn an ein Smartphone.');
      }
      if (device.status === 'LOST' || device.securityStatus === 'COMPROMISED') {
        throw new AppError('conflict', 'Als verloren gemeldete oder kompromittierte Stempel müssen zuerst neue Schlüssel erhalten.');
      }
    }
    await this.prisma.nfcDevice.update({
      where: { id },
      data: { status: input.status, ...(input.status === 'LOST' ? { securityStatus: 'COMPROMISED' } : {}) },
    });
    await this.logEvent(device, 'STATUS_CHANGED', { from: device.status, to: input.status, reason: input.reason ?? null }, ctx.ip);
    await this.audit.byUser(ctx, `device.${input.status.toLowerCase()}`, { type: 'NfcDevice', id }, { reason: input.reason ?? null });
    return this.get(ctx, id);
  }

  /**
   * Erzeugt neue Schlüssel. Ein physischer Chip muss danach neu personalisiert
   * und per Tap erneut aktiviert werden; alte URLs sind sofort wertlos.
   */
  async rotateKeys(ctx: TenantContext, id: string) {
    const device = await this.load(ctx, id);
    if (device.status === 'RETIRED') throw new AppError('conflict', 'Dieses Gerät wurde außer Betrieb genommen.');
    if (device.kind === 'ACTIVE_READER') throw new AppError('conflict', 'Aktive Stempel verwenden ein Geräte-Schlüsselpaar.');
    const simulated = device.kind === 'SIMULATED';
    await this.prisma.nfcDevice.update({
      where: { id },
      data: {
        metaKeyEnc: encryptSecret(randomBytes(16)),
        fileKeyEnc: encryptSecret(randomBytes(16)),
        keyVersion: { increment: 1 },
        lastCounter: -1,
        simCounter: 0,
        rejectedTaps: 0,
        securityStatus: 'OK',
        uidHex: simulated ? device.uidHex : null,
        status: simulated ? 'ACTIVE' : 'PENDING',
        activatedAt: simulated ? device.activatedAt : null,
      },
    });
    // Offene Taps mit altem Schlüsselstand verfallen.
    await this.prisma.tapEvent.updateMany({ where: { deviceId: id, status: { in: ['VERIFIED', 'PENDING_APPROVAL', 'PENDING_POS'] } }, data: { status: 'EXPIRED' } });
    await this.logEvent(device, 'KEYS_ROTATED', { keyVersion: device.keyVersion + 1 }, ctx.ip);
    await this.audit.byUser(ctx, 'device.keys_rotated', { type: 'NfcDevice', id });
    return this.get(ctx, id);
  }

  /** Gibt die Schlüssel für die Chip-Personalisierung heraus. Jeder Abruf wird protokolliert. */
  async personalization(ctx: TenantContext, id: string) {
    const device = await this.load(ctx, id);
    if (device.kind !== 'PASSIVE_NTAG424') throw new AppError('conflict', 'Nur physische NTAG-424-Stempel werden personalisiert.');
    if (!device.metaKeyEnc || !device.fileKeyEnc) throw new AppError('internal_error', 'Schlüssel fehlen.');
    let profile = null;
    let warning: string | null = null;
    try {
      profile = buildPersonalizationProfile({ webUrl: this.env.WEB_URL, publicId: device.publicId });
    } catch (err) {
      warning = (err as Error).message;
    }
    await this.logEvent(device, 'KEYS_REVEALED', { keyVersion: device.keyVersion }, ctx.ip);
    await this.audit.byUser(ctx, 'device.keys_revealed', { type: 'NfcDevice', id }, { keyVersion: device.keyVersion });
    return {
      publicId: device.publicId,
      keyVersion: device.keyVersion,
      keys: {
        sdmMetaReadKey: decryptSecret(device.metaKeyEnc).toString('hex').toUpperCase(),
        sdmFileReadKey: decryptSecret(device.fileKeyEnc).toString('hex').toUpperCase(),
      },
      profile,
      warning,
    };
  }

  /**
   * SIMULATION: erzeugt die URL, die ein echter Chip beim nächsten Lesen liefern
   * würde. Die anschließende Verarbeitung ist identisch zu echter Hardware.
   */
  async simulateTap(ctx: TenantContext, id: string) {
    if (!this.env.NFC_SIMULATOR_ENABLED) throw new AppError('simulator_disabled', 'Der Simulationsmodus ist auf diesem System nicht aktiviert.');
    const device = await this.load(ctx, id);
    if (device.kind !== 'SIMULATED') throw new AppError('conflict', 'Nur simulierte Stempel können einen Tap erzeugen.');
    if (!device.metaKeyEnc || !device.fileKeyEnc || !device.uidHex) throw new AppError('internal_error', 'Schlüssel fehlen.');
    const updated = await this.prisma.nfcDevice.update({ where: { id }, data: { simCounter: { increment: 1 } }, select: { simCounter: true } });
    if (updated.simCounter > SDM_COUNTER_MAX) throw new AppError('conflict', 'Der Zähler dieses Stempels ist erschöpft.');
    const sun = generateSun({ metaKey: decryptSecret(device.metaKeyEnc), fileKey: decryptSecret(device.fileKeyEnc), uidHex: device.uidHex, counter: updated.simCounter });
    return {
      simulated: true as const,
      deviceId: device.publicId,
      e: sun.piccDataHex,
      c: sun.macHex,
      counter: updated.simCounter,
      url: buildTapUrl(this.env.WEB_URL, device.publicId, sun.piccDataHex, sun.macHex),
    };
  }
}
