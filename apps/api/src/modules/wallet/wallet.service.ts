import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createPkpass, createSaveUrl, GoogleWalletClient, pushPassUpdate, type ApplePassConfig, type GoogleWalletConfig } from '@tably/wallet';
import { ENV, type Env } from '../../common/env';
import { PrismaService } from '../../common/prisma.service';
import { QueueService } from '../../common/queue.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { SessionService } from '../../common/session.service';
import { AppError, notFound } from '../../common/errors';
import { decryptSecret, encryptSecret, randomToken, safeEqual } from '../../common/crypto';
import type { CustomerBrowser } from '../../common/auth.types';
import { CardsService } from '../cards/cards.service';

const pem = (value: string) => value.replace(/\\n/g, '\n');

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger('Wallet');
  private googleClient: GoogleWalletClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly cards: CardsService,
    private readonly entitlements: EntitlementsService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.queue.register('wallet.sync', (p: { cardId: string }) => this.syncCard(p.cardId));
    this.queue.register('wallet.syncProgram', (p: { programId: string }) => this.syncProgram(p.programId));
  }

  appleConfig(): ApplePassConfig | null {
    const e = this.env;
    if (!e.APPLE_PASS_TYPE_ID || !e.APPLE_TEAM_ID || !e.APPLE_PASS_CERT_PEM || !e.APPLE_PASS_KEY_PEM || !e.APPLE_WWDR_CERT_PEM) return null;
    return {
      passTypeIdentifier: e.APPLE_PASS_TYPE_ID,
      teamIdentifier: e.APPLE_TEAM_ID,
      certificatePem: pem(e.APPLE_PASS_CERT_PEM),
      privateKeyPem: pem(e.APPLE_PASS_KEY_PEM),
      privateKeyPassphrase: e.APPLE_PASS_KEY_PASSPHRASE,
      wwdrPem: pem(e.APPLE_WWDR_CERT_PEM),
      webServiceUrl: `${e.API_PUBLIC_URL.replace(/\/+$/, '')}/wallet/apple`,
    };
  }

  googleConfig(): GoogleWalletConfig | null {
    const e = this.env;
    if (!e.GOOGLE_WALLET_ISSUER_ID || !e.GOOGLE_WALLET_SA_EMAIL || !e.GOOGLE_WALLET_SA_PRIVATE_KEY) return null;
    return { issuerId: e.GOOGLE_WALLET_ISSUER_ID, serviceAccountEmail: e.GOOGLE_WALLET_SA_EMAIL, privateKeyPem: pem(e.GOOGLE_WALLET_SA_PRIVATE_KEY) };
  }

  private google(): GoogleWalletClient | null {
    const config = this.googleConfig();
    if (!config) return null;
    this.googleClient ??= new GoogleWalletClient(config);
    return this.googleClient;
  }

  async status(organizationId: string) {
    const counts = await this.prisma.walletPass.groupBy({ by: ['platform'], where: { organizationId }, _count: { _all: true } });
    const count = (platform: string) => counts.find((c) => c.platform === platform)?._count._all ?? 0;
    const errors = await this.prisma.walletPass.count({ where: { organizationId, lastError: { not: null } } });
    return {
      apple: { configured: Boolean(this.appleConfig()), passes: count('APPLE') },
      google: { configured: Boolean(this.googleConfig()), passes: count('GOOGLE') },
      passesWithErrors: errors,
    };
  }

  private async assertOwnedCard(browser: CustomerBrowser, cardId: string) {
    const card = await this.prisma.loyaltyCard.findUnique({ where: { id: cardId }, select: { id: true, organizationId: true, customerId: true, status: true } });
    if (!card) throw notFound('Karte');
    const customerId = await this.sessions.customerFor(browser.tokenHash, card.organizationId);
    if (customerId !== card.customerId) throw notFound('Karte');
    await this.entitlements.assertFeature(card.organizationId, 'walletPasses', 'Wallet-Karten');
    return card;
  }

  private async buildApplePass(cardId: string, config: ApplePassConfig): Promise<{ pkpass: Buffer; updatedAt: Date }> {
    const { model, organizationId, version } = await this.cards.walletModel(cardId);
    let pass = await this.prisma.walletPass.findUnique({ where: { cardId_platform: { cardId, platform: 'APPLE' } } });
    if (!pass || !pass.authTokenEnc) {
      pass = await this.prisma.walletPass.upsert({
        where: { cardId_platform: { cardId, platform: 'APPLE' } },
        create: { organizationId, cardId, platform: 'APPLE', authTokenEnc: encryptSecret(randomToken()), externalId: model.serial, lastVersion: version },
        update: { authTokenEnc: pass?.authTokenEnc ?? encryptSecret(randomToken()) },
      });
    }
    const pkpass = createPkpass(config, { card: model, authenticationToken: decryptSecret(pass.authTokenEnc!).toString() });
    const card = await this.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: cardId }, select: { updatedAt: true } });
    return { pkpass, updatedAt: card.updatedAt };
  }

  /** Kund:in lädt den Apple-Wallet-Pass herunter. */
  async applePassForCustomer(browser: CustomerBrowser, cardId: string): Promise<Buffer> {
    const config = this.appleConfig();
    if (!config) throw new AppError('integration_not_configured', 'Apple Wallet ist auf diesem System noch nicht eingerichtet.');
    const card = await this.assertOwnedCard(browser, cardId);
    return (await this.buildApplePass(card.id, config)).pkpass;
  }

  /** „Add to Google Wallet“-Link für die Karte. */
  async googleSaveUrlForCustomer(browser: CustomerBrowser, cardId: string): Promise<{ url: string }> {
    const config = this.googleConfig();
    if (!config) throw new AppError('integration_not_configured', 'Google Wallet ist auf diesem System noch nicht eingerichtet.');
    const card = await this.assertOwnedCard(browser, cardId);
    const { model, programId, organizationId, version } = await this.cards.walletModel(card.id);
    await this.prisma.walletPass.upsert({
      where: { cardId_platform: { cardId: card.id, platform: 'GOOGLE' } },
      create: { organizationId, cardId: card.id, platform: 'GOOGLE', externalId: model.serial, lastVersion: version },
      update: {},
    });
    return { url: createSaveUrl(config, programId, model, [new URL(this.env.WEB_URL).origin]) };
  }

  // ── Aktualisierung nach Buchungen ─────────────────────────────────────
  async syncProgram(programId: string): Promise<void> {
    const passes = await this.prisma.walletPass.findMany({ where: { card: { programId } }, select: { cardId: true }, distinct: ['cardId'] });
    if (passes.length === 0) return;
    // Designänderungen erhöhen die Kartenversion, damit Geräte den Pass neu laden.
    await this.prisma.loyaltyCard.updateMany({ where: { id: { in: passes.map((p) => p.cardId) } }, data: { version: { increment: 1 } } });
    for (const pass of passes) await this.queue.enqueue('wallet.sync', { cardId: pass.cardId });
  }

  async syncCard(cardId: string): Promise<void> {
    const passes = await this.prisma.walletPass.findMany({ where: { cardId }, include: { registrations: true } });
    if (passes.length === 0) return;
    const { model, programId, version } = await this.cards.walletModel(cardId);
    for (const pass of passes) {
      if (pass.lastVersion >= version) continue;
      try {
        if (pass.platform === 'APPLE') {
          const config = this.appleConfig();
          if (!config) continue;
          const tokens = pass.registrations.map((r) => r.pushToken);
          const results = await pushPassUpdate(
            { passTypeIdentifier: config.passTypeIdentifier, certificatePem: config.certificatePem, privateKeyPem: config.privateKeyPem, privateKeyPassphrase: config.privateKeyPassphrase },
            tokens,
          );
          const dead = results.filter((r) => r.unregistered).map((r) => r.pushToken);
          if (dead.length) await this.prisma.appleDeviceRegistration.deleteMany({ where: { walletPassId: pass.id, pushToken: { in: dead } } });
          const failed = results.filter((r) => !r.ok && !r.unregistered);
          await this.prisma.walletPass.update({
            where: { id: pass.id },
            data: { lastVersion: version, lastPushedAt: new Date(), lastError: failed.length ? `APNs: ${failed[0]!.reason ?? failed[0]!.status}` : null },
          });
        } else {
          const client = this.google();
          if (!client) continue;
          // false = Objekt existiert noch nicht (Karte wurde nie gespeichert) – kein Fehler.
          await client.updateObject(programId, model);
          await this.prisma.walletPass.update({ where: { id: pass.id }, data: { lastVersion: version, lastPushedAt: new Date(), lastError: null } });
        }
      } catch (err) {
        const message = (err as Error).message.slice(0, 300);
        this.logger.warn(`Wallet-Aktualisierung (${pass.platform}) für Karte ${cardId} fehlgeschlagen: ${message}`);
        await this.prisma.walletPass.update({ where: { id: pass.id }, data: { lastError: message } });
        throw err; // BullMQ wiederholt den Job
      }
    }
  }

  // ── Apple-Pass-Webservice ─────────────────────────────────────────────
  private async authorizedPass(passTypeId: string, serial: string, authorization: string | undefined) {
    const config = this.appleConfig();
    if (!config || passTypeId !== config.passTypeIdentifier) throw new AppError('unauthenticated', 'Unbekannter Pass-Typ.');
    const token = authorization?.startsWith('ApplePass ') ? authorization.slice('ApplePass '.length).trim() : null;
    const pass = await this.prisma.walletPass.findFirst({ where: { platform: 'APPLE', externalId: serial } });
    if (!token || !pass?.authTokenEnc || !safeEqual(decryptSecret(pass.authTokenEnc).toString(), token)) {
      throw new AppError('unauthenticated', 'Pass-Authentifizierung fehlgeschlagen.');
    }
    return { pass, config };
  }

  async registerDevice(deviceLibraryIdentifier: string, passTypeId: string, serial: string, authorization: string | undefined, pushToken: string): Promise<'created' | 'exists'> {
    const { pass } = await this.authorizedPass(passTypeId, serial, authorization);
    const existing = await this.prisma.appleDeviceRegistration.findUnique({ where: { walletPassId_deviceLibraryIdentifier: { walletPassId: pass.id, deviceLibraryIdentifier } } });
    await this.prisma.appleDeviceRegistration.upsert({
      where: { walletPassId_deviceLibraryIdentifier: { walletPassId: pass.id, deviceLibraryIdentifier } },
      create: { walletPassId: pass.id, deviceLibraryIdentifier, pushToken },
      update: { pushToken },
    });
    return existing ? 'exists' : 'created';
  }

  async unregisterDevice(deviceLibraryIdentifier: string, passTypeId: string, serial: string, authorization: string | undefined): Promise<void> {
    const { pass } = await this.authorizedPass(passTypeId, serial, authorization);
    await this.prisma.appleDeviceRegistration.deleteMany({ where: { walletPassId: pass.id, deviceLibraryIdentifier } });
  }

  /** Seriennummern der Pässe eines Geräts, die sich seit `since` (Unix-Sekunden) geändert haben. */
  async updatedSerials(deviceLibraryIdentifier: string, passTypeId: string, since: string | undefined): Promise<{ serialNumbers: string[]; lastUpdated: string } | null> {
    const config = this.appleConfig();
    if (!config || passTypeId !== config.passTypeIdentifier) return null;
    const sinceDate = since && /^\d+$/.test(since) ? new Date(Number(since) * 1000) : new Date(0);
    const registrations = await this.prisma.appleDeviceRegistration.findMany({
      where: { deviceLibraryIdentifier, walletPass: { platform: 'APPLE', card: { updatedAt: { gt: sinceDate } } } },
      include: { walletPass: { select: { externalId: true, card: { select: { updatedAt: true } } } } },
    });
    if (registrations.length === 0) return null;
    const latest = Math.max(...registrations.map((r) => r.walletPass.card.updatedAt.getTime()));
    return { serialNumbers: registrations.map((r) => r.walletPass.externalId!).filter(Boolean), lastUpdated: String(Math.ceil(latest / 1000)) };
  }

  async latestPass(passTypeId: string, serial: string, authorization: string | undefined): Promise<{ pkpass: Buffer; updatedAt: Date }> {
    const { pass, config } = await this.authorizedPass(passTypeId, serial, authorization);
    return this.buildApplePass(pass.cardId, config);
  }

  async deviceLog(logs: string[]): Promise<void> {
    if (logs.length === 0) return;
    await this.prisma.systemError.create({ data: { source: 'apple-wallet-device', message: logs.join('\n').slice(0, 1000) } }).catch(() => undefined);
  }
}
