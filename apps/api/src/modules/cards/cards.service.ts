import { Inject, Injectable } from '@nestjs/common';
import type { LoyaltyProgram, Organization, Reward } from '@tapperl/database';
import { cardDesignSchema, type CardDesign } from '@tapperl/types';
import type { WalletCardModel } from '@tapperl/wallet';
import { ENV, type Env } from '../../common/env';
import { PrismaService, isUniqueViolation, type Tx } from '../../common/prisma.service';
import { hashToken, keyedHash, randomId, randomShortCode } from '../../common/crypto';
import { addDays } from '../../common/util';
import { notFound } from '../../common/errors';

export function parseDesign(raw: unknown): CardDesign {
  const parsed = cardDesignSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : cardDesignSchema.parse({});
}

export function unitLabel(program: Pick<LoyaltyProgram, 'type'>): string {
  return program.type === 'POINTS' ? 'Punkte' : 'Stempel';
}

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  assetUrl(assetId: string | null | undefined): string | null {
    return assetId ? `/api/public/assets/${assetId}` : null;
  }

  /** Öffentliche Beschreibung eines Programms (Anmeldeseite, Kartenansicht, Vorschau). */
  programView(program: LoyaltyProgram & { rewards?: Reward[] }, org: Pick<Organization, 'name' | 'slug' | 'logoAssetId' | 'brandColor'>) {
    const design = parseDesign(program.design);
    return {
      id: program.id,
      slug: program.slug,
      type: program.type,
      status: program.status,
      name: program.name,
      cardTitle: program.cardTitle,
      description: program.description,
      stampsRequired: program.stampsRequired,
      stampIcon: program.stampIcon,
      unitLabel: unitLabel(program),
      design,
      terms: program.terms,
      validFrom: program.validFrom,
      validUntil: program.validUntil,
      signupBonus: program.signupBonus,
      logoUrl: this.assetUrl(design.showLogo ? (design.logoAssetId ?? org.logoAssetId) : null),
      organization: { name: org.name, slug: org.slug },
      rewards: (program.rewards ?? [])
        .filter((r) => r.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.cost - b.cost)
        .map((r) => ({ id: r.id, name: r.name, description: r.description, cost: r.cost, type: r.type, value: r.value })),
    };
  }

  /**
   * Zugriffstoken einer Karte (Link im Wallet-Pass). Wird aus der Seriennummer
   * und dem Anwendungsschlüssel abgeleitet, damit es bei jeder Pass-Erzeugung
   * erneut berechnet werden kann, ohne im Klartext gespeichert zu sein.
   */
  accessTokenFor(serial: string): string {
    return keyedHash('card-access', serial);
  }

  async createCard(tx: Tx, input: { organizationId: string; program: Pick<LoyaltyProgram, 'id' | 'cardValidityDays'>; customerId: string }) {
    for (let attempt = 0; ; attempt++) {
      const serial = randomId('card', 15);
      const accessToken = this.accessTokenFor(serial);
      try {
        const card = await tx.loyaltyCard.create({
          data: {
            organizationId: input.organizationId,
            programId: input.program.id,
            customerId: input.customerId,
            serial,
            accessTokenHash: hashToken(accessToken),
            shortCode: randomShortCode(),
            expiresAt: input.program.cardValidityDays ? addDays(new Date(), input.program.cardValidityDays) : null,
          },
        });
        return { card, accessToken };
      } catch (err) {
        if (!isUniqueViolation(err) || attempt >= 4) throw err;
      }
    }
  }

  /** Vollständige Kartenansicht für die Webkarte. Liest ausschließlich serverseitige Stände. */
  async cardView(cardId: string, organizationId?: string) {
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { id: cardId, ...(organizationId ? { organizationId } : {}) },
      include: { program: { include: { rewards: true } }, customer: true, organization: true },
    });
    if (!card) throw notFound('Karte');
    const now = new Date();
    const [history, offers, pendingRedemption] = await Promise.all([
      this.prisma.stampTransaction.findMany({
        where: { cardId: card.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, type: true, amount: true, note: true, createdAt: true },
      }),
      this.prisma.campaign.findMany({
        where: {
          organizationId: card.organizationId,
          channels: { has: 'CARD' },
          OR: [{ programId: null }, { programId: card.programId }],
          AND: [
            { OR: [{ status: 'ACTIVE' }, { status: 'SENT' }] },
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            { type: { in: ['OFFER', 'ANNOUNCEMENT', 'BONUS_STAMPS'] } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, type: true, subject: true, body: true, endsAt: true },
      }),
      this.prisma.rewardRedemption.findFirst({ where: { cardId: card.id, status: 'PENDING', codeExpiresAt: { gt: now } }, select: { id: true, rewardName: true, codeExpiresAt: true } }),
    ]);
    const program = this.programView(card.program, card.organization);
    return {
      id: card.id,
      shortCode: card.shortCode,
      status: card.status,
      balance: card.balance,
      lifetimeEarned: card.lifetimeEarned,
      visits: card.visits,
      version: card.version,
      lastStampAt: card.lastStampAt,
      expiresAt: card.expiresAt,
      createdAt: card.createdAt,
      customer: { firstName: card.customer.firstName, email: card.customer.email, birthday: card.customer.birthday, status: card.customer.status },
      program,
      rewards: program.rewards.map((r) => ({ ...r, available: card.balance >= r.cost, missing: Math.max(0, r.cost - card.balance) })),
      offers,
      history,
      pendingRedemption,
    };
  }

  /** Plattformneutrales Modell für Wallet-Pässe. */
  async walletModel(cardId: string): Promise<{ model: WalletCardModel; programId: string; organizationId: string; version: number }> {
    const card = await this.prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: { include: { rewards: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }] } } }, customer: true, organization: true },
    });
    if (!card) throw notFound('Karte');
    const design = parseDesign(card.program.design);
    const mainReward = card.program.rewards[0];
    const logoAssetId = design.showLogo ? (design.logoAssetId ?? card.organization.logoAssetId) : null;
    let logoPng: Buffer | null = null;
    if (logoAssetId) {
      const asset = await this.prisma.asset.findFirst({ where: { id: logoAssetId, organizationId: card.organizationId, mimeType: 'image/png' } });
      logoPng = asset ? Buffer.from(asset.data) : null;
    }
    const offer = await this.prisma.campaign.findFirst({
      where: { organizationId: card.organizationId, channels: { has: 'WALLET' }, status: { in: ['ACTIVE', 'SENT'] }, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      select: { subject: true, body: true },
    });
    const base = this.env.WEB_URL.replace(/\/+$/, '');
    return {
      programId: card.programId,
      organizationId: card.organizationId,
      version: card.version,
      model: {
        serial: card.serial,
        shortCode: card.shortCode,
        organizationName: card.organization.name,
        programName: card.program.name,
        cardTitle: card.program.cardTitle,
        description: card.program.description,
        customerName: [card.customer.firstName, card.customer.lastName].filter(Boolean).join(' '),
        balance: card.balance,
        stampsRequired: card.program.stampsRequired,
        rewardsAvailable: mainReward ? Math.floor(card.balance / mainReward.cost) : 0,
        rewardName: mainReward?.name ?? '',
        unitLabel: unitLabel(card.program),
        backgroundColor: design.backgroundColor,
        textColor: design.textColor,
        accentColor: design.accentColor,
        cardUrl: `${base}/c/${this.accessTokenFor(card.serial)}`,
        terms: card.program.terms,
        expiresAt: card.expiresAt,
        message: offer ? [offer.subject, offer.body].filter(Boolean).join(' – ').slice(0, 300) : null,
        logoPng,
        logoUrl: `${this.env.API_PUBLIC_URL.replace(/\/+$/, '')}/public/organizations/${card.organization.slug}/icon.png`,
      },
    };
  }
}
