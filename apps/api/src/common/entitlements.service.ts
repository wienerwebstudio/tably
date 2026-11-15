import { Injectable } from '@nestjs/common';
import { PAST_DUE_GRACE_DAYS, UNLIMITED, type PlanFeatures, type PlanLimits } from '@tably/config';
import type { Plan, Subscription } from '@tably/database';
import { PrismaService } from './prisma.service';
import { AppError } from './errors';

export interface EffectiveSubscription {
  subscription: Subscription;
  plan: Plan;
  limits: PlanLimits;
  features: PlanFeatures;
  /** false = Konto ist eingeschränkt (nur Lesen und Abrechnung) */
  writable: boolean;
}

const DAY = 86_400_000;

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lädt das Abo und schreibt fällige Statuswechsel fort:
   * abgelaufene Testphase bzw. überschrittene Kulanzzeit → RESTRICTED.
   */
  async get(organizationId: string): Promise<EffectiveSubscription> {
    let subscription = await this.prisma.subscription.findUnique({ where: { organizationId }, include: { plan: true } });
    if (!subscription) throw new AppError('internal_error', 'Für diese Organisation existiert kein Abonnement.');
    const now = Date.now();
    let next: Subscription['status'] | null = null;
    if (subscription.status === 'TRIALING' && subscription.trialEndsAt && subscription.trialEndsAt.getTime() < now) next = 'RESTRICTED';
    if (subscription.status === 'PAST_DUE' && subscription.pastDueSince && subscription.pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY < now) next = 'RESTRICTED';
    if (
      subscription.provider === 'LOCAL' &&
      subscription.status === 'ACTIVE' &&
      subscription.cancelAtPeriodEnd &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() < now
    ) {
      next = 'CANCELED';
    }
    if (next) {
      subscription = await this.prisma.subscription.update({ where: { organizationId }, data: { status: next }, include: { plan: true } });
    }
    const limits = { ...(subscription.plan.limits as unknown as PlanLimits), ...((subscription.limitOverrides as Partial<PlanLimits> | null) ?? {}) };
    return {
      subscription,
      plan: subscription.plan,
      limits,
      features: subscription.plan.features as unknown as PlanFeatures,
      writable: subscription.status !== 'RESTRICTED' && subscription.status !== 'CANCELED',
    };
  }

  async assertWritable(organizationId: string): Promise<EffectiveSubscription> {
    const eff = await this.get(organizationId);
    if (!eff.writable) {
      throw new AppError('subscription_restricted', 'Dein Konto ist eingeschränkt. Bitte wähle einen Tarif, um weiterzuarbeiten.', {
        details: { status: eff.subscription.status },
      });
    }
    return eff;
  }

  async usage(organizationId: string): Promise<Record<keyof PlanLimits, number>> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [locations, devices, programs, staff, invitations, customers, campaignsPerMonth] = await Promise.all([
      this.prisma.location.count({ where: { organizationId, isActive: true } }),
      this.prisma.nfcDevice.count({ where: { organizationId, status: { not: 'RETIRED' } } }),
      this.prisma.loyaltyProgram.count({ where: { organizationId, status: { not: 'ARCHIVED' } } }),
      this.prisma.organizationMember.count({ where: { organizationId } }),
      this.prisma.invitation.count({ where: { organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.customer.count({ where: { organizationId, status: { not: 'ANONYMIZED' } } }),
      this.prisma.campaign.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
    ]);
    return { locations, devices, programs, staff: staff + invitations, customers, campaignsPerMonth };
  }

  /** Prüft, ob ein weiteres Element der Art `key` angelegt werden darf. */
  async assertLimit(organizationId: string, key: keyof PlanLimits, label: string): Promise<void> {
    const [eff, usage] = await Promise.all([this.get(organizationId), this.usage(organizationId)]);
    const limit = eff.limits[key];
    if (limit !== UNLIMITED && usage[key] >= limit) {
      throw new AppError('limit_reached', `Dein Tarif „${eff.plan.name}“ erlaubt höchstens ${limit} ${label}.`, {
        details: { key, limit, current: usage[key], planId: eff.plan.id },
      });
    }
  }

  async assertFeature(organizationId: string, feature: keyof PlanFeatures, label: string): Promise<void> {
    const eff = await this.get(organizationId);
    if (!eff.features[feature]) {
      throw new AppError('feature_not_in_plan', `${label} ist im Tarif „${eff.plan.name}“ nicht enthalten.`, { details: { feature, planId: eff.plan.id } });
    }
  }
}
