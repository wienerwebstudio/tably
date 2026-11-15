import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { DEFAULT_PLANS, TRIAL_DAYS, integrationStatus } from '@tapperl/config';
import type { contactSchema, customerSelfUpdateSchema, enrollSchema } from '@tapperl/types';
import { renderIcon } from '@tapperl/wallet';
import { ENV, type Env } from '../../common/env';
import { PrismaService, isUniqueViolation } from '../../common/prisma.service';
import { SessionService } from '../../common/session.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { MailService } from '../../common/mail.service';
import { AuditService } from '../../common/audit.service';
import { AppError, notFound } from '../../common/errors';
import { hashToken, randomToken } from '../../common/crypto';
import type { CustomerBrowser } from '../../common/auth.types';
import { CardsService, parseDesign } from '../cards/cards.service';
import { CustomersService } from '../customers/customers.service';
import { LedgerService } from '../ledger/ledger.service';
import { TapsService, type TapResult } from '../nfc/taps.service';

interface Meta {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly entitlements: EntitlementsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly cards: CardsService,
    private readonly customers: CustomersService,
    private readonly ledger: LedgerService,
    private readonly taps: TapsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async findProgram(orgSlug: string, programSlug: string) {
    const program = await this.prisma.loyaltyProgram.findFirst({
      where: { slug: programSlug, organization: { slug: orgSlug } },
      include: { rewards: true, organization: true },
    });
    if (!program || program.status === 'DRAFT' || program.status === 'ARCHIVED') throw notFound('Treueprogramm');
    return program;
  }

  async program(orgSlug: string, programSlug: string, browser: CustomerBrowser) {
    const program = await this.findProgram(orgSlug, programSlug);
    const customerId = await this.sessions.customerFor(browser.tokenHash, program.organizationId);
    const card = customerId ? await this.prisma.loyaltyCard.findUnique({ where: { programId_customerId: { programId: program.id, customerId } }, select: { id: true } }) : null;
    return {
      program: this.cards.programView(program, program.organization),
      open: program.status === 'PUBLISHED' && program.organization.status === 'ACTIVE',
      cardId: card?.id ?? null,
    };
  }

  async enroll(orgSlug: string, programSlug: string, input: z.infer<typeof enrollSchema>, tokenHash: string, meta: Meta): Promise<{ cardId: string; created: boolean; tap: TapResult | null }> {
    const program = await this.findProgram(orgSlug, programSlug);
    const organizationId = program.organizationId;
    if (program.status !== 'PUBLISHED' || program.organization.status !== 'ACTIVE') {
      throw new AppError('program_not_published', 'Für dieses Treueprogramm ist derzeit keine Anmeldung möglich.');
    }
    const subscription = await this.entitlements.get(organizationId);
    if (!subscription.writable) throw new AppError('program_not_published', 'Für dieses Treueprogramm ist derzeit keine Anmeldung möglich.');

    let customerId = await this.sessions.customerFor(tokenHash, organizationId);
    let cardId: string | null = null;
    let created = false;

    if (customerId) {
      const existing = await this.prisma.loyaltyCard.findUnique({ where: { programId_customerId: { programId: program.id, customerId } }, select: { id: true } });
      cardId = existing?.id ?? null;
    }

    if (!cardId) {
      if (!customerId) {
        try {
          await this.entitlements.assertLimit(organizationId, 'customers', 'Kunden');
        } catch {
          // Tariflimits sind Sache des Händlers – Kund:innen sehen eine neutrale Meldung.
          throw new AppError('program_not_published', 'Für dieses Treueprogramm ist derzeit keine Anmeldung möglich.');
        }
        if (input.email) {
          const taken = await this.prisma.customer.findUnique({ where: { organizationId_email: { organizationId, email: input.email } }, select: { id: true } });
          // Kein automatisches Anmelden in ein bestehendes Konto – das wäre eine Kontoübernahme.
          if (taken) {
            throw new AppError('email_taken', 'Mit dieser E-Mail-Adresse gibt es bereits eine Karte. Nutze „Karte wiederfinden“, um sie auf diesem Gerät zu öffnen.', { fields: { email: 'Bereits registriert' } });
          }
        }
      }
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          let id = customerId;
          if (!id) {
            const customer = await tx.customer.create({
              data: {
                organizationId,
                firstName: input.firstName,
                lastName: input.lastName ?? null,
                email: input.email ?? null,
                birthday: input.birthday ? new Date(`${input.birthday}T00:00:00.000Z`) : null,
                source: input.tapToken ? 'nfc_tap' : 'signup_link',
                lastActivityAt: new Date(),
              },
            });
            id = customer.id;
            await this.customers.recordConsent(tx, { organizationId, customerId: id, type: 'PRIVACY', granted: true, source: 'signup', ...meta });
            await this.customers.recordConsent(tx, { organizationId, customerId: id, type: 'MARKETING_EMAIL', granted: Boolean(input.marketingConsent && input.email), source: 'signup', ...meta });
            await this.customers.recordConsent(tx, { organizationId, customerId: id, type: 'MARKETING_WALLET', granted: Boolean(input.marketingConsent), source: 'signup', ...meta });
          }
          const { card } = await this.cards.createCard(tx, { organizationId, program, customerId: id });
          return { customerId: id, cardId: card.id };
        });
        customerId = result.customerId;
        cardId = result.cardId;
        created = true;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        throw new AppError('conflict', 'Die Karte wurde gerade schon angelegt. Bitte lade die Seite neu.');
      }
      await this.sessions.linkCustomer(tokenHash, organizationId, customerId, meta.userAgent);
      if (program.signupBonus > 0) {
        await this.ledger.earn({ organizationId, cardId, amount: program.signupBonus, source: 'SIGNUP_BONUS', idempotencyKey: `signup:${cardId}`, enforceLimits: false, applyMultiplier: false, note: 'Willkommensbonus' });
      }
      await this.audit.log({ organizationId, actorType: 'CUSTOMER', actorId: customerId, action: 'customer.enrolled', targetType: 'LoyaltyCard', targetId: cardId, ...meta });
    }

    let tap: TapResult | null = null;
    if (input.tapToken && customerId) tap = await this.taps.claim(input.tapToken, { cardId, customerId, organizationId });
    return { cardId, created, tap };
  }

  /** Stellt sicher, dass die Karte zum Browser gehört. */
  private async requireCard(browser: CustomerBrowser, cardId: string) {
    const card = await this.prisma.loyaltyCard.findUnique({ where: { id: cardId }, select: { id: true, organizationId: true, customerId: true, serial: true } });
    if (!card) throw notFound('Karte');
    const customerId = await this.sessions.customerFor(browser.tokenHash, card.organizationId);
    if (customerId !== card.customerId) throw notFound('Karte');
    return card;
  }

  async myCards(browser: CustomerBrowser) {
    if (!browser.tokenHash) return [];
    const sessions = await this.prisma.customerSession.findMany({ where: { tokenHash: browser.tokenHash, expiresAt: { gt: new Date() } }, select: { customerId: true } });
    if (sessions.length === 0) return [];
    const cards = await this.prisma.loyaltyCard.findMany({
      where: { customerId: { in: sessions.map((s) => s.customerId) }, customer: { status: { not: 'ANONYMIZED' } } },
      include: { program: true, organization: true },
      orderBy: { updatedAt: 'desc' },
    });
    return cards.map((c) => ({
      id: c.id,
      balance: c.balance,
      status: c.status,
      organizationName: c.organization.name,
      cardTitle: c.program.cardTitle,
      stampsRequired: c.program.stampsRequired,
      stampIcon: c.program.stampIcon,
      design: parseDesign(c.program.design),
      logoUrl: this.cards.assetUrl(parseDesign(c.program.design).logoAssetId ?? c.organization.logoAssetId),
    }));
  }

  async card(browser: CustomerBrowser, cardId: string) {
    const card = await this.requireCard(browser, cardId);
    const [view, consents] = await Promise.all([this.cards.cardView(card.id), this.customers.consentState(card.customerId)]);
    const status = integrationStatus(this.env);
    return {
      ...view,
      marketingConsent: Boolean(consents.MARKETING_EMAIL?.granted || consents.MARKETING_WALLET?.granted),
      wallet: { apple: status.appleWallet, google: status.googleWallet },
    };
  }

  async updateProfile(browser: CustomerBrowser, cardId: string, input: z.infer<typeof customerSelfUpdateSchema>, meta: Meta) {
    const card = await this.requireCard(browser, cardId);
    const { marketingConsent, birthday, ...rest } = input;
    try {
      await this.prisma.customer.update({
        where: { id: card.customerId },
        data: { ...rest, ...(birthday !== undefined ? { birthday: birthday ? new Date(`${birthday}T00:00:00.000Z`) : null } : {}) },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError('email_taken', 'Diese E-Mail-Adresse wird bereits verwendet.', { fields: { email: 'Bereits vergeben' } });
      throw err;
    }
    if (marketingConsent !== undefined) {
      const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: card.customerId }, select: { email: true } });
      await this.customers.recordConsent(this.prisma, { organizationId: card.organizationId, customerId: card.customerId, type: 'MARKETING_EMAIL', granted: marketingConsent && Boolean(customer.email), source: 'customer', ...meta });
      await this.customers.recordConsent(this.prisma, { organizationId: card.organizationId, customerId: card.customerId, type: 'MARKETING_WALLET', granted: marketingConsent, source: 'customer', ...meta });
    }
    return this.card(browser, cardId);
  }

  async requestRedemption(browser: CustomerBrowser, cardId: string, rewardId: string) {
    const card = await this.requireCard(browser, cardId);
    return this.ledger.requestRedemption({ organizationId: card.organizationId, cardId: card.id, rewardId });
  }

  async cancelRedemption(browser: CustomerBrowser, cardId: string): Promise<void> {
    const card = await this.requireCard(browser, cardId);
    await this.prisma.rewardRedemption.updateMany({ where: { cardId: card.id, status: 'PENDING' }, data: { status: 'CANCELED', codeHash: null } });
  }

  async exportMyData(browser: CustomerBrowser, cardId: string) {
    const card = await this.requireCard(browser, cardId);
    await this.audit.log({ organizationId: card.organizationId, actorType: 'CUSTOMER', actorId: card.customerId, action: 'customer.self_export' });
    return this.customers.exportData(card.organizationId, card.customerId);
  }

  async deleteMyData(browser: CustomerBrowser, cardId: string): Promise<void> {
    const card = await this.requireCard(browser, cardId);
    await this.customers.anonymize(card.organizationId, card.customerId);
    await this.audit.log({ organizationId: card.organizationId, actorType: 'CUSTOMER', actorId: card.customerId, action: 'customer.self_deleted', targetType: 'Customer', targetId: card.customerId });
  }

  /** Öffnet eine Karte über den Link im Wallet-Pass auf diesem Gerät. */
  async accessByToken(token: string, tokenHash: string, meta: Meta): Promise<{ cardId: string }> {
    const card = await this.prisma.loyaltyCard.findUnique({ where: { accessTokenHash: hashToken(token) }, include: { customer: { select: { status: true } } } });
    if (!card || card.customer.status === 'ANONYMIZED') throw new AppError('token_invalid', 'Dieser Link ist ungültig.');
    await this.sessions.linkCustomer(tokenHash, card.organizationId, card.customerId, meta.userAgent);
    return { cardId: card.id };
  }

  async recover(orgSlug: string, email: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { email, status: 'ACTIVE', organization: { slug: orgSlug } }, include: { organization: { select: { name: true } } } });
    if (!customer) return; // keine Auskunft, ob die Adresse bekannt ist
    const token = randomToken();
    await this.prisma.customerLoginToken.create({ data: { organizationId: customer.organizationId, customerId: customer.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    await this.mail.send({
      to: email,
      kind: 'customer.recover',
      organizationId: customer.organizationId,
      customerId: customer.id,
      subject: `Deine Karte bei ${customer.organization.name}`,
      text: `Hallo ${customer.firstName},\n\nüber diesen Link öffnest du deine Treuekarte auf diesem Gerät:\n${this.env.WEB_URL}/karten/wiederfinden?token=${token}\n\nDer Link ist 30 Minuten gültig.`,
    });
  }

  async consumeRecovery(token: string, tokenHash: string, meta: Meta): Promise<{ cardId: string | null }> {
    const record = await this.prisma.customerLoginToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError('token_invalid', 'Dieser Link ist ungültig oder abgelaufen.');
    const used = await this.prisma.customerLoginToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw new AppError('token_invalid', 'Dieser Link wurde bereits verwendet.');
    await this.sessions.linkCustomer(tokenHash, record.organizationId, record.customerId, meta.userAgent);
    const card = await this.prisma.loyaltyCard.findFirst({ where: { customerId: record.customerId }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
    return { cardId: card?.id ?? null };
  }

  async asset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.kind !== 'logo') throw notFound('Datei');
    return asset;
  }

  async organizationIcon(slug: string): Promise<{ data: Buffer; mimeType: string }> {
    const org = await this.prisma.organization.findUnique({ where: { slug }, select: { brandColor: true, logoAssetId: true } });
    if (!org) throw notFound('Organisation');
    if (org.logoAssetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: org.logoAssetId } });
      if (asset) return { data: Buffer.from(asset.data), mimeType: asset.mimeType };
    }
    return { data: renderIcon(256, org.brandColor, '#FFFFFF'), mimeType: 'image/png' };
  }

  async plans() {
    const plans = await this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    const source = plans.length ? plans : DEFAULT_PLANS.map((p) => ({ ...p, isActive: true }));
    return {
      trialDays: TRIAL_DAYS,
      plans: source.map((p) => ({ id: p.id, name: p.name, description: p.description, priceMonthlyCents: p.priceMonthlyCents, priceYearlyCents: p.priceYearlyCents, currency: p.currency, limits: p.limits, features: p.features })),
    };
  }

  async contact(input: z.infer<typeof contactSchema>, ip: string | null): Promise<void> {
    if (input.website) return; // Honeypot ausgefüllt → stillschweigend verwerfen
    await this.prisma.contactRequest.create({ data: { name: input.name, email: input.email, company: input.company ?? null, topic: input.topic ?? null, message: input.message, ip } });
  }

  status() {
    const status = integrationStatus(this.env);
    return { wallet: { apple: status.appleWallet, google: status.googleWallet }, nfcSimulator: status.nfcSimulator };
  }
}
