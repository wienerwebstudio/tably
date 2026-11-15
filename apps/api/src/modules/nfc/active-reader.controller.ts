import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { verifyDeviceRequest } from '@tably/nfc';
import type { AppRequest } from '../../common/auth.types';
import { PrismaService } from '../../common/prisma.service';
import { AppError } from '../../common/errors';
import { LedgerService } from '../ledger/ledger.service';
import { DevicesService } from './devices.service';

const reportSchema = z.object({
  cardIdentifier: z.string().trim().min(4).max(80),
  channel: z.enum(['qr', 'nfc_hce', 'apple_vas', 'google_smart_tap']),
  sequence: z.number().int().min(0).max(2_000_000_000),
  firmware: z.string().max(40).optional(),
  batteryPercent: z.number().int().min(0).max(100).optional(),
});

/**
 * Schnittstelle für aktive Stempel (Ausbaustufe B). Authentifizierung über
 * Ed25519-signierte Anfragen statt Cookies – siehe @tably/nfc `active.ts`.
 *
 * Stand: Das Backend ist vorbereitet und getestet. Es existiert noch keine
 * Hardware, und das Auslesen von Wallet-Pässen per Apple VAS / Google Smart Tap
 * setzt Freigaben der Hersteller voraus (siehe docs/integrations.md).
 */
@ApiTags('Aktive Stempel (Ausbaustufe B)')
@Controller('devices/v1')
export class ActiveReaderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly devices: DevicesService,
  ) {}

  @Post('taps')
  @HttpCode(200)
  @ApiOperation({ summary: 'Signierte Meldung eines aktiven Stempels: Karte gelesen' })
  async tap(
    @Req() req: AppRequest,
    @Headers('x-tably-device') publicId: string | undefined,
    @Headers('x-tably-timestamp') timestamp: string | undefined,
    @Headers('x-tably-nonce') nonce: string | undefined,
    @Headers('x-tably-signature') signature: string | undefined,
  ) {
    const denied = new AppError('unauthenticated', 'Geräteauthentifizierung fehlgeschlagen.');
    if (!publicId || !timestamp || !nonce || !signature || !req.rawBody) throw denied;
    const device = await this.prisma.nfcDevice.findUnique({ where: { publicId }, include: { program: true } });
    if (!device || device.kind !== 'ACTIVE_READER' || !device.publicKey) throw denied;
    const body = req.rawBody.toString('utf8');
    const check = verifyDeviceRequest(device.publicKey, { publicId, timestamp: Number(timestamp), nonce, method: 'POST', path: '/devices/v1/taps', body }, signature);
    if (!check.ok) {
      await this.devices.logEvent(device, 'SIGNATURE_REJECTED', { reason: check.reason }, req.ip);
      await this.prisma.nfcDevice.update({ where: { id: device.id }, data: { rejectedTaps: { increment: 1 } } });
      throw denied;
    }
    if (device.status !== 'ACTIVE' || device.securityStatus === 'COMPROMISED') throw new AppError('device_inactive', 'Gerät ist nicht aktiv.');
    if (!device.program) throw new AppError('device_unassigned', 'Dem Gerät ist kein Treueprogramm zugeordnet.');

    const parsed = reportSchema.safeParse(JSON.parse(body));
    if (!parsed.success) throw new AppError('validation_failed', 'Ungültige Meldung.');
    const report = parsed.data;

    // Replay-Schutz: die Sequenznummer muss streng steigen (atomar geprüft).
    const advanced = await this.prisma.nfcDevice.updateMany({ where: { id: device.id, lastCounter: { lt: report.sequence } }, data: { lastCounter: report.sequence, lastUsedAt: new Date(), firmware: report.firmware ?? device.firmware } });
    if (advanced.count === 0) {
      await this.devices.logEvent(device, 'REPLAY', { sequence: report.sequence }, req.ip);
      throw new AppError('tap_replayed', 'Diese Meldung wurde bereits verarbeitet.');
    }

    const raw = report.cardIdentifier.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { organizationId: device.organizationId, programId: device.program.id, OR: [{ serial: report.cardIdentifier }, { shortCode: raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : report.cardIdentifier }] },
      select: { id: true },
    });
    if (!card) throw new AppError('not_found', 'Karte nicht gefunden.');

    const result = await this.ledger.earn({
      organizationId: device.organizationId,
      cardId: card.id,
      amount: device.program.stampsPerTap,
      source: 'ACTIVE_READER',
      idempotencyKey: `reader:${device.id}:${report.sequence}`,
      deviceId: device.id,
      locationId: device.locationId,
      enforceLimits: true,
    });
    await this.devices.logEvent(device, 'TAP_OK', { sequence: report.sequence, channel: report.channel }, req.ip);
    return { status: 'completed', amount: result.transaction.amount, balance: result.card.balance, stampsRequired: device.program.stampsRequired };
  }
}
