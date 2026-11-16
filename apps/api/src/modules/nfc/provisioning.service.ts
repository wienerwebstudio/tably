import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';
import { buildPersonalizationProfile, verifySun } from '@tapperl/nfc';
import { ENV, type Env } from '../../common/env';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, notFound } from '../../common/errors';
import { decryptSecret, encryptSecret, hashToken } from '../../common/crypto';
import type { TenantContext } from '../../common/auth.types';
import { DevicesService } from './devices.service';

/** Ohne leicht verwechselbare Zeichen (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;
export const PROVISIONING_TTL_MINUTES = 30;

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const hex = (enc: string | null) => (enc ? decryptSecret(enc).toString('hex').toUpperCase() : null);

/**
 * Einrichtung physischer NTAG-424-Stempel mit der Tapperl-Einrichtungs-App (Android).
 * Das Dashboard erzeugt einen kurzlebigen Einmal-Code; die App holt damit die
 * Schlüssel, schreibt den Chip und meldet den ersten echten SUN-Lesevorgang zurück.
 */
@Injectable()
export class ProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly devices: DevicesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(ctx: TenantContext, deviceId: string) {
    const device = await this.prisma.nfcDevice.findFirst({ where: { id: deviceId, organizationId: ctx.organizationId } });
    if (!device) throw notFound('Gerät');
    if (device.kind !== 'PASSIVE_NTAG424') throw new AppError('conflict', 'Nur physische NTAG-424-Stempel werden mit der App eingerichtet.');
    if (device.status === 'RETIRED') throw new AppError('conflict', 'Dieses Gerät wurde außer Betrieb genommen.');
    // Profil vorab prüfen (z. B. https-Pflicht), damit die App keinen unbrauchbaren Code bekommt.
    try {
      buildPersonalizationProfile({ webUrl: this.env.WEB_URL, publicId: device.publicId });
    } catch (err) {
      throw new AppError('conflict', (err as Error).message);
    }

    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    const expiresAt = new Date(Date.now() + PROVISIONING_TTL_MINUTES * 60_000);
    // Ältere, noch offene Codes dieses Geräts werden ungültig.
    await this.prisma.deviceProvisioning.updateMany({ where: { deviceId, completedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } });
    await this.prisma.deviceProvisioning.create({
      data: { organizationId: ctx.organizationId, deviceId, codeHash: hashToken(code), createdById: ctx.userId, expiresAt },
    });
    await this.devices.logEvent(device, 'PROVISIONING_CODE_CREATED', { expiresAt }, ctx.ip);
    await this.audit.byUser(ctx, 'device.provisioning_code_created', { type: 'NfcDevice', id: deviceId });

    const display = `${code.slice(0, 5)}-${code.slice(5)}`;
    const api = this.env.API_PUBLIC_URL.replace(/\/+$/, '');
    const query = `code=${display}&api=${encodeURIComponent(api)}`;
    return {
      code: display,
      expiresAt,
      appUrl: `tapperl://einrichten?${query}`,
      webUrl: `${this.env.WEB_URL.replace(/\/+$/, '')}/einrichten?${query}`,
    };
  }

  private async findValid(rawCode: string) {
    const code = normalizeCode(rawCode);
    const invalid = new AppError('not_found', 'Dieser Einrichtungscode ist ungültig oder abgelaufen. Bitte im Dashboard einen neuen erzeugen.');
    if (code.length !== CODE_LENGTH) throw invalid;
    const entry = await this.prisma.deviceProvisioning.findUnique({ where: { codeHash: hashToken(code) }, include: { device: { include: { organization: { select: { name: true } } } } } });
    if (!entry || entry.completedAt || entry.expiresAt <= new Date()) throw invalid;
    if (entry.device.kind !== 'PASSIVE_NTAG424' || entry.device.status === 'RETIRED') throw invalid;
    return entry;
  }

  /** Von der App aufgerufen: liefert Schlüssel und NDEF-Profil (wird protokolliert). */
  async fetch(rawCode: string, ip: string | null) {
    const entry = await this.findValid(rawCode);
    let device = entry.device;
    if (!device.metaKeyEnc || !device.fileKeyEnc) throw new AppError('internal_error', 'Schlüssel fehlen.');
    if (!device.masterKeyEnc) {
      // Bedingt, damit parallele Abrufe nicht zwei verschiedene Masterschlüssel erzeugen.
      await this.prisma.nfcDevice.updateMany({ where: { id: device.id, masterKeyEnc: null }, data: { masterKeyEnc: encryptSecret(randomBytes(16)) } });
      device = { ...device, ...(await this.prisma.nfcDevice.findUniqueOrThrow({ where: { id: device.id }, select: { masterKeyEnc: true } })) };
    }
    await this.prisma.deviceProvisioning.update({ where: { id: entry.id }, data: { fetchedAt: entry.fetchedAt ?? new Date() } });
    await this.devices.logEvent(device, 'KEYS_REVEALED', { keyVersion: device.keyVersion, via: 'app' }, ip);
    await this.audit.log({ organizationId: device.organizationId, actorType: 'SYSTEM', action: 'device.keys_revealed', targetType: 'NfcDevice', targetId: device.id, metadata: { via: 'provisioning_app' }, ip });

    const profile = buildPersonalizationProfile({ webUrl: this.env.WEB_URL, publicId: device.publicId });
    const chipMeta = hex(device.chipMetaKeyEnc);
    const chipFile = hex(device.chipFileKeyEnc);
    return {
      device: { name: device.name, publicId: device.publicId, organization: device.organization.name },
      keyVersion: device.keyVersion,
      profile: {
        ndefUriPayload: profile.ndefUriPayload,
        piccDataOffset: profile.piccDataOffset,
        sdmMacInputOffset: profile.sdmMacInputOffset,
        sdmMacOffset: profile.sdmMacOffset,
      },
      keys: { master: hex(device.masterKeyEnc)!, sdmMetaRead: hex(device.metaKeyEnc)!, sdmFileRead: hex(device.fileKeyEnc)! },
      /** Werte, die nach einer Schlüsselrotation noch auf dem Chip stehen können. */
      previousKeys: { sdmMetaRead: chipMeta ? [chipMeta] : [], sdmFileRead: chipFile ? [chipFile] : [] },
    };
  }

  /** Von der App aufgerufen: erster Lesevorgang des fertigen Chips → UID binden, Stempel aktivieren. */
  async complete(rawCode: string, input: { e: string; c: string }, ip: string | null) {
    const entry = await this.findValid(rawCode);
    const device = entry.device;
    if (!device.metaKeyEnc || !device.fileKeyEnc) throw new AppError('internal_error', 'Schlüssel fehlen.');
    const sun = verifySun({ metaKey: decryptSecret(device.metaKeyEnc), fileKey: decryptSecret(device.fileKeyEnc), piccDataHex: input.e, macHex: input.c });
    if (!sun.ok) {
      await this.devices.logEvent(device, 'PROVISIONING_FAILED', { reason: sun.reason }, ip);
      throw new AppError('validation_failed', 'Der Chip liefert keine gültige Signatur. Bitte die Einrichtung wiederholen.');
    }
    if (device.uidHex && device.uidHex !== sun.uidHex) {
      await this.devices.logEvent(device, 'PROVISIONING_FAILED', { reason: 'uid_mismatch', uid: sun.uidHex }, ip);
      throw new AppError('conflict', 'Dieser Stempel ist bereits mit einem anderen Chip verknüpft. Bitte im Dashboard zuerst „Schlüssel erneuern“ wählen.');
    }
    await this.prisma.$transaction([
      this.prisma.nfcDevice.update({
        where: { id: device.id },
        data: {
          uidHex: sun.uidHex,
          chipMetaKeyEnc: device.metaKeyEnc,
          chipFileKeyEnc: device.fileKeyEnc,
          lastCounter: Math.max(device.lastCounter, sun.counter),
          ...(device.status === 'PENDING' ? { status: 'ACTIVE' as const, activatedAt: new Date() } : {}),
        },
      }),
      this.prisma.deviceProvisioning.update({ where: { id: entry.id }, data: { completedAt: new Date() } }),
    ]);
    await this.devices.logEvent(device, 'PROVISIONED', { uid: sun.uidHex, counter: sun.counter, keyVersion: device.keyVersion }, ip);
    await this.audit.log({ organizationId: device.organizationId, actorType: 'DEVICE', actorId: device.id, action: 'device.provisioned', targetType: 'NfcDevice', targetId: device.id, ip });
    return { ok: true as const, device: { name: device.name, status: device.status === 'PENDING' ? 'ACTIVE' : device.status, uidHex: sun.uidHex } };
  }
}
