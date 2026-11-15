import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';
import { DEFAULT_PLANS, UNLIMITED, type PlanLimits } from '@tapperl/config';
import type { BillingInterval, Plan, SubscriptionStatus } from '@tapperl/database';
import { ENV, type Env } from '../../common/env';
import { Prisma, PrismaService, isUniqueViolation } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { AppError } from '../../common/errors';
import type { TenantContext } from '../../common/auth.types';

const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  locations: 'Standorte',
  devices: 'NFC-Stempel',
  programs: 'Treueprogramme',
  staff: 'Teammitglieder',
  customers: 'Kunden',
  campaignsPerMonth: 'Kampagnen pro Monat',
};

function addInterval(from: Date, interval: BillingInterval): Date {
  const d = new Date(from);
  if (interval === 'YEAR') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const STRIPE_STATUS: Record<string, SubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  unpaid: 'RESTRICTED',
  canceled: 'CANCELED',
  incomplete: 'PAST_DUE',
  incomplete_expired: 'CANCELED',
  paused: 'RESTRICTED',
};

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger('Billing');
  readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  }

  /** `stripe` = echte Zahlungen, `local` = Testmodus ohne Zahlungsabwicklung. */
  get mode(): 'stripe' | 'local' {
    return this.stripe && this.env.STRIPE_WEBHOOK_SECRET ? 'stripe' : 'local';
  }

  /** Legt die Standardtarife an, falls die Tabelle leer ist. Bestehende Tarife werden nie überschrieben. */
  async onModuleInit(): Promise<void> {
    for (const plan of DEFAULT_PLANS) {
      await this.prisma.plan
        .upsert({
          where: { id: plan.id },
          update: {},
          create: {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceMonthlyCents: plan.priceMonthlyCents,
            priceYearlyCents: plan.priceYearlyCents,
            currency: plan.currency,
            limits: plan.limits as unknown as Prisma.InputJsonValue,
            features: plan.features as unknown as Prisma.InputJsonValue,
            sortOrder: plan.sortOrder,
          },
        })
        .catch((err) => {
          if (!isUniqueViolation(err)) throw err;
        });
    }
  }

  async overview(ctx: TenantContext) {
    const [eff, usage, plans, invoices] = await Promise.all([
      this.entitlements.get(ctx.organizationId),
      this.entitlements.usage(ctx.organizationId),
      this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.invoice.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' }, take: 24 }),
    ]);
    const s = eff.subscription;
    return {
      mode: this.mode,
      subscription: {
        planId: s.planId,
        status: s.status,
        interval: s.interval,
        provider: s.provider,
        trialEndsAt: s.trialEndsAt,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        pastDueSince: s.pastDueSince,
        writable: eff.writable,
      },
      limits: eff.limits,
      features: eff.features,
      usage,
      plans: plans.map((p) => ({ id: p.id, name: p.name, description: p.description, priceMonthlyCents: p.priceMonthlyCents, priceYearlyCents: p.priceYearlyCents, currency: p.currency, limits: p.limits, features: p.features })),
      invoices,
    };
  }

  /** Ein Wechsel ist nur möglich, wenn die aktuelle Nutzung in den Zieltarif passt. */
  private async assertFits(organizationId: string, plan: Plan): Promise<void> {
    const usage = await this.entitlements.usage(organizationId);
    const limits = plan.limits as unknown as PlanLimits;
    const over = (Object.keys(LIMIT_LABELS) as Array<keyof PlanLimits>)
      .filter((key) => key !== 'campaignsPerMonth' && limits[key] !== UNLIMITED && usage[key] > limits[key])
      .map((key) => `${LIMIT_LABELS[key]}: ${usage[key]} von ${limits[key]}`);
    if (over.length) {
      throw new AppError('limit_reached', `Der Tarif „${plan.name}“ ist für deine aktuelle Nutzung zu klein (${over.join(', ')}).`, { details: { over } });
    }
  }

  async changePlan(ctx: TenantContext, planId: string, interval: BillingInterval): Promise<{ checkoutUrl?: string; applied: boolean }> {
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new AppError('not_found', 'Tarif nicht gefunden.');
    await this.assertFits(ctx.organizationId, plan);
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { organizationId: ctx.organizationId } });

    if (this.mode === 'local') {
      const now = new Date();
      const amount = interval === 'YEAR' ? plan.priceYearlyCents : plan.priceMonthlyCents;
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { organizationId: ctx.organizationId },
          data: { planId: plan.id, interval, status: 'ACTIVE', provider: 'LOCAL', currentPeriodStart: now, currentPeriodEnd: addInterval(now, interval), cancelAtPeriodEnd: false, canceledAt: null, pastDueSince: null, trialEndsAt: null },
        });
        const count = await tx.invoice.count({ where: { organizationId: ctx.organizationId } });
        await tx.invoice.create({
          data: {
            organizationId: ctx.organizationId,
            provider: 'LOCAL',
            number: `TEST-${now.getUTCFullYear()}-${String(count + 1).padStart(4, '0')}`,
            description: `${plan.name} (${interval === 'YEAR' ? 'jährlich' : 'monatlich'}) – Testmodus, keine Zahlung`,
            amountCents: amount,
            currency: plan.currency,
            status: 'test',
            periodStart: now,
            periodEnd: addInterval(now, interval),
            isTest: true,
          },
        });
      });
      await this.audit.byUser(ctx, 'billing.plan_changed', undefined, { planId, interval, mode: 'local' });
      return { applied: true };
    }

    const priceId = interval === 'YEAR' ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;
    if (!priceId) throw new AppError('integration_not_configured', 'Für diesen Tarif ist in Stripe noch kein Preis hinterlegt.');
    const stripe = this.stripe!;

    if (subscription.stripeSubscriptionId) {
      const current = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      const item = current.items.data[0];
      if (!item) throw new AppError('internal_error', 'Stripe-Abonnement ohne Position.');
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, { items: [{ id: item.id, price: priceId }], proration_behavior: 'create_prorations', cancel_at_period_end: false });
      await this.audit.byUser(ctx, 'billing.plan_changed', undefined, { planId, interval, mode: 'stripe' });
      // Der endgültige Stand kommt über den Webhook customer.subscription.updated.
      return { applied: true };
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, email: org.email ?? undefined, metadata: { organizationId: org.id } });
      customerId = customer.id;
      await this.prisma.subscription.update({ where: { organizationId: org.id }, data: { stripeCustomerId: customerId } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: org.id,
      subscription_data: { metadata: { organizationId: org.id } },
      automatic_tax: { enabled: false },
      success_url: `${this.env.DASHBOARD_URL}/einstellungen/abo?checkout=success`,
      cancel_url: `${this.env.DASHBOARD_URL}/einstellungen/abo?checkout=cancel`,
    });
    if (!session.url) throw new AppError('internal_error', 'Stripe hat keine Checkout-URL geliefert.');
    return { checkoutUrl: session.url, applied: false };
  }

  async setCancel(ctx: TenantContext, cancel: boolean): Promise<void> {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { organizationId: ctx.organizationId } });
    if (!['ACTIVE', 'PAST_DUE'].includes(subscription.status)) throw new AppError('conflict', 'Es gibt kein laufendes Abonnement, das gekündigt werden könnte.');
    if (subscription.provider === 'STRIPE' && subscription.stripeSubscriptionId && this.stripe) {
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: cancel });
    }
    await this.prisma.subscription.update({ where: { organizationId: ctx.organizationId }, data: { cancelAtPeriodEnd: cancel, canceledAt: cancel ? new Date() : null } });
    await this.audit.byUser(ctx, cancel ? 'billing.canceled' : 'billing.resumed');
  }

  async portalUrl(ctx: TenantContext): Promise<{ url: string }> {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { organizationId: ctx.organizationId } });
    if (this.mode !== 'stripe' || !subscription.stripeCustomerId) throw new AppError('integration_not_configured', 'Das Kundenportal steht erst mit aktiver Stripe-Anbindung zur Verfügung.');
    const session = await this.stripe!.billingPortal.sessions.create({ customer: subscription.stripeCustomerId, return_url: `${this.env.DASHBOARD_URL}/einstellungen/abo` });
    return { url: session.url };
  }

  /** Nur lokaler Testmodus: Zahlungsereignisse nachstellen, um Einschränkungen zu prüfen. */
  async simulate(ctx: TenantContext, event: 'payment_failed' | 'payment_succeeded' | 'grace_expired'): Promise<void> {
    if (this.mode !== 'local' || this.env.NODE_ENV === 'production') throw new AppError('forbidden', 'Nur im lokalen Testmodus verfügbar.');
    const data =
      event === 'payment_failed'
        ? { status: 'PAST_DUE' as const, pastDueSince: new Date() }
        : event === 'grace_expired'
          ? { status: 'PAST_DUE' as const, pastDueSince: new Date(Date.now() - 30 * 86_400_000) }
          : { status: 'ACTIVE' as const, pastDueSince: null };
    await this.prisma.subscription.update({ where: { organizationId: ctx.organizationId }, data });
    await this.audit.byUser(ctx, 'billing.simulated', undefined, { event });
  }

  // ── Stripe-Webhooks ───────────────────────────────────────────────────
  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ duplicate: boolean }> {
    if (!this.stripe || !this.env.STRIPE_WEBHOOK_SECRET) throw new AppError('integration_not_configured', 'Stripe ist nicht eingerichtet.');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature ?? '', this.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new AppError('unauthenticated', 'Ungültige Webhook-Signatur.', { status: 400 });
    }
    // Idempotenz: jedes Ereignis wird genau einmal verarbeitet.
    let record;
    try {
      record = await this.prisma.billingEvent.create({ data: { provider: 'STRIPE', eventId: event.id, type: event.type, payload: event as unknown as Prisma.InputJsonValue } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const existing = await this.prisma.billingEvent.findUniqueOrThrow({ where: { provider_eventId: { provider: 'STRIPE', eventId: event.id } } });
      if (existing.processedAt) return { duplicate: true };
      record = existing; // früherer Versuch ist gescheitert → erneut verarbeiten
    }
    try {
      const organizationId = await this.applyStripeEvent(event);
      await this.prisma.billingEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), organizationId, error: null } });
    } catch (err) {
      await this.prisma.billingEvent.update({ where: { id: record.id }, data: { error: (err as Error).message.slice(0, 500) } });
      throw err; // 5xx → Stripe stellt erneut zu
    }
    return { duplicate: false };
  }

  private async orgForCustomer(customerId: string | null | undefined): Promise<string | null> {
    if (!customerId) return null;
    const subscription = await this.prisma.subscription.findUnique({ where: { stripeCustomerId: customerId }, select: { organizationId: true } });
    return subscription?.organizationId ?? null;
  }

  private async applyStripeEvent(event: Stripe.Event): Promise<string | null> {
    const object = event.data.object as any;
    const id = (value: unknown): string | null => (typeof value === 'string' ? value : value && typeof value === 'object' ? ((value as { id?: string }).id ?? null) : null);
    const date = (seconds: unknown): Date | null => (typeof seconds === 'number' ? new Date(seconds * 1000) : null);

    switch (event.type) {
      case 'checkout.session.completed': {
        const organizationId: string | null = object.client_reference_id ?? (await this.orgForCustomer(id(object.customer)));
        if (!organizationId) return null;
        await this.prisma.subscription.update({
          where: { organizationId },
          data: { provider: 'STRIPE', stripeCustomerId: id(object.customer) ?? undefined, stripeSubscriptionId: id(object.subscription) ?? undefined },
        });
        return organizationId;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const organizationId: string | null = object.metadata?.organizationId ?? (await this.orgForCustomer(id(object.customer)));
        if (!organizationId) return null;
        const item = object.items?.data?.[0];
        const priceId: string | undefined = item?.price?.id;
        const plan = priceId ? await this.prisma.plan.findFirst({ where: { OR: [{ stripePriceMonthlyId: priceId }, { stripePriceYearlyId: priceId }] } }) : null;
        const status: SubscriptionStatus = event.type === 'customer.subscription.deleted' ? 'CANCELED' : (STRIPE_STATUS[object.status] ?? 'RESTRICTED');
        // Neuere API-Versionen führen die Periode an der Position statt am Abonnement.
        const periodStart = date(object.current_period_start ?? item?.current_period_start);
        const periodEnd = date(object.current_period_end ?? item?.current_period_end);
        const current = await this.prisma.subscription.findUnique({ where: { organizationId } });
        if (!current) return null;
        await this.prisma.subscription.update({
          where: { organizationId },
          data: {
            provider: 'STRIPE',
            status,
            stripeSubscriptionId: object.id,
            stripeCustomerId: id(object.customer) ?? undefined,
            ...(plan ? { planId: plan.id, interval: plan.stripePriceYearlyId === priceId ? 'YEAR' : 'MONTH' } : {}),
            currentPeriodStart: periodStart ?? undefined,
            currentPeriodEnd: periodEnd ?? undefined,
            trialEndsAt: date(object.trial_end),
            cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
            canceledAt: date(object.canceled_at),
            pastDueSince: status === 'PAST_DUE' ? (current.pastDueSince ?? new Date()) : null,
          },
        });
        await this.audit.log({ organizationId, actorType: 'SYSTEM', action: 'billing.subscription_synced', metadata: { status, planId: plan?.id ?? null, event: event.type } });
        return organizationId;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const organizationId = await this.orgForCustomer(id(object.customer));
        if (!organizationId) return null;
        const line = object.lines?.data?.[0];
        const invoiceData = {
          organizationId,
          provider: 'STRIPE' as const,
          externalId: object.id as string,
          number: (object.number as string | null) ?? object.id,
          description: (line?.description as string | undefined) ?? 'Tapperl Abonnement',
          amountCents: (object.amount_due as number | undefined) ?? 0,
          currency: String(object.currency ?? 'eur').toUpperCase(),
          status: event.type === 'invoice.paid' ? 'paid' : 'payment_failed',
          periodStart: date(line?.period?.start),
          periodEnd: date(line?.period?.end),
          hostedUrl: (object.hosted_invoice_url as string | null) ?? null,
          pdfUrl: (object.invoice_pdf as string | null) ?? null,
        };
        await this.prisma.invoice.upsert({ where: { provider_externalId: { provider: 'STRIPE', externalId: object.id } }, create: invoiceData, update: invoiceData });
        if (event.type === 'invoice.payment_failed') {
          const current = await this.prisma.subscription.findUniqueOrThrow({ where: { organizationId } });
          if (current.status === 'ACTIVE' || current.status === 'TRIALING') {
            await this.prisma.subscription.update({ where: { organizationId }, data: { status: 'PAST_DUE', pastDueSince: new Date() } });
          }
          await this.audit.log({ organizationId, actorType: 'SYSTEM', action: 'billing.payment_failed', metadata: { invoice: object.id } });
        } else {
          await this.prisma.subscription.updateMany({ where: { organizationId, status: { in: ['PAST_DUE', 'RESTRICTED'] } }, data: { status: 'ACTIVE', pastDueSince: null } });
        }
        return organizationId;
      }
      default:
        this.logger.debug(`Stripe-Ereignis ${event.type} wird nicht ausgewertet.`);
        return null;
    }
  }
}
