import { Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { integrationStatus } from '@tably/config';
import { adminOrgUpdateSchema, adminUpdatePlanSchema, adminUserUpdateSchema, paginationSchema } from '@tably/types';
import { ZBody, ZQuery } from '../../common/zod';
import { CurrentAuth, SuperAdmin } from '../../common/guards';
import type { AuthContext } from '../../common/auth.types';
import { ENV, type Env } from '../../common/env';
import { Prisma, PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { SessionService } from '../../common/session.service';
import { QueueService } from '../../common/queue.service';
import { MailService } from '../../common/mail.service';
import { AppError, notFound } from '../../common/errors';
import { BillingService } from '../billing/billing.service';

const deviceQuery = paginationSchema.extend({ security: z.enum(['OK', 'WARNING', 'COMPROMISED']).optional() });
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * Verwaltungsbereich des Plattformbetreibers. Alle Routen verlangen
 * `User.isSuperAdmin`; für alle anderen Konten antworten sie mit 404.
 * Händlerrollen (auch OWNER) haben hier keinerlei Zugriff.
 */
@ApiTags('Super-Admin')
@SuperAdmin()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly sessions: SessionService,
    private readonly queue: QueueService,
    private readonly mail: MailService,
    private readonly billing: BillingService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private log(auth: AuthContext, action: string, target: { type: string; id: string }, metadata?: Record<string, unknown>, organizationId?: string) {
    return this.audit.log({ organizationId, actorType: 'SUPER_ADMIN', actorId: auth.user.id, action, targetType: target.type, targetId: target.id, metadata });
  }

  @Get('overview')
  async overview() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [orgs, subs, users, customers, cards, devices, stamps, errors24h, flagged, contacts, paid] = await Promise.all([
      this.prisma.organization.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.subscription.groupBy({ by: ['status', 'provider'], _count: { _all: true } }),
      this.prisma.user.count(),
      this.prisma.customer.count({ where: { status: { not: 'ANONYMIZED' } } }),
      this.prisma.loyaltyCard.count({ where: { status: 'ACTIVE' } }),
      this.prisma.nfcDevice.groupBy({ by: ['status', 'securityStatus'], _count: { _all: true } }),
      this.prisma.stampTransaction.aggregate({ where: { type: 'EARN', createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.systemError.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      this.prisma.stampTransaction.count({ where: { flagged: true, createdAt: { gte: since } } }),
      this.prisma.contactRequest.count({ where: { handledAt: null } }),
      this.prisma.subscription.findMany({ where: { status: 'ACTIVE', provider: 'STRIPE' }, select: { interval: true, plan: { select: { priceMonthlyCents: true, priceYearlyCents: true } } } }),
    ]);
    // Nur echte (Stripe-)Abos zählen; Testmodus-Abos erzeugen keinen Umsatz.
    const mrrCents = paid.reduce((sum, s) => sum + (s.interval === 'YEAR' ? Math.round(s.plan.priceYearlyCents / 12) : s.plan.priceMonthlyCents), 0);
    return {
      organizations: Object.fromEntries(orgs.map((o) => [o.status, o._count._all])),
      subscriptions: subs.map((s) => ({ status: s.status, provider: s.provider, count: s._count._all })),
      users,
      customers,
      activeCards: cards,
      devices: devices.map((d) => ({ status: d.status, securityStatus: d.securityStatus, count: d._count._all })),
      stamps30d: { amount: stamps._sum.amount ?? 0, bookings: stamps._count._all },
      flagged30d: flagged,
      errors24h,
      openContactRequests: contacts,
      mrrCents,
      mrrNote: 'Rechnerischer Monatswert aktiver Stripe-Abonnements laut Tarifpreis. Testmodus-Abos sind nicht enthalten.',
    };
  }

  @Get('system')
  async system() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    return {
      database,
      queueDriver: this.queue.driver,
      mailMode: this.mail.mode,
      billingMode: this.billing.mode,
      integrations: integrationStatus(this.env),
      environment: this.env.NODE_ENV,
      urls: { web: this.env.WEB_URL, dashboard: this.env.DASHBOARD_URL, api: this.env.API_PUBLIC_URL },
    };
  }

  @Get('organizations')
  async organizations(@ZQuery(paginationSchema) q: z.infer<typeof paginationSchema>) {
    const where: Prisma.OrganizationWhereInput = q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } : {};
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { subscription: { select: { planId: true, status: true, provider: true, trialEndsAt: true, currentPeriodEnd: true } }, _count: { select: { customers: true, devices: true, members: true, programs: true } } },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('organizations/:id')
  async organization(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true, disabledAt: true } } } },
        locations: true,
        programs: { select: { id: true, name: true, status: true, type: true, bookingPolicy: true } },
        devices: { select: { id: true, name: true, kind: true, status: true, securityStatus: true, lastUsedAt: true, rejectedTaps: true } },
      },
    });
    if (!org) throw notFound('Organisation');
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [usage, eff, stamps, flagged, audit, invoices] = await Promise.all([
      this.entitlements.usage(id),
      this.entitlements.get(id),
      this.prisma.stampTransaction.count({ where: { organizationId: id, type: 'EARN', createdAt: { gte: since } } }),
      this.prisma.stampTransaction.count({ where: { organizationId: id, flagged: true, createdAt: { gte: since } } }),
      this.prisma.auditLog.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.invoice.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'desc' }, take: 12 }),
    ]);
    return { organization: org, usage, limits: eff.limits, stamps30d: stamps, flagged30d: flagged, audit, invoices };
  }

  @Patch('organizations/:id')
  async updateOrganization(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @ZBody(adminOrgUpdateSchema) body: z.infer<typeof adminOrgUpdateSchema>) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!org) throw notFound('Organisation');
    if (body.status) {
      await this.prisma.organization.update({ where: { id }, data: { status: body.status, suspendedReason: body.status === 'SUSPENDED' ? (body.suspendedReason ?? null) : null } });
    }
    const sub: Prisma.SubscriptionUncheckedUpdateInput = {};
    if (body.planId) sub.planId = body.planId;
    if (body.subscriptionStatus) {
      sub.status = body.subscriptionStatus;
      sub.pastDueSince = body.subscriptionStatus === 'PAST_DUE' ? new Date() : null;
    }
    if (body.trialEndsAt !== undefined) sub.trialEndsAt = body.trialEndsAt;
    if (body.limitOverrides !== undefined) sub.limitOverrides = body.limitOverrides === null ? Prisma.DbNull : body.limitOverrides;
    if (Object.keys(sub).length) await this.prisma.subscription.update({ where: { organizationId: id }, data: sub });
    await this.log(auth, 'admin.organization_updated', { type: 'Organization', id }, body as Record<string, unknown>, id);
    return this.organization(id);
  }

  @Get('users')
  async users(@ZQuery(paginationSchema) q: z.infer<typeof paginationSchema>) {
    const where: Prisma.UserWhereInput = q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, email: true, name: true, isSuperAdmin: true, emailVerifiedAt: true, totpEnabledAt: true, lastLoginAt: true, disabledAt: true, createdAt: true,
          memberships: { select: { role: true, organization: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Patch('users/:id')
  async updateUser(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @ZBody(adminUserUpdateSchema) body: z.infer<typeof adminUserUpdateSchema>) {
    if (id === auth.user.id) throw new AppError('conflict', 'Das eigene Konto kann nicht gesperrt werden.');
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw notFound('Benutzer');
    await this.prisma.user.update({ where: { id }, data: { disabledAt: body.disabled ? new Date() : null } });
    if (body.disabled) await this.sessions.revokeAllForUser(id);
    await this.log(auth, body.disabled ? 'admin.user_disabled' : 'admin.user_enabled', { type: 'User', id });
    return { ok: true };
  }

  @Get('devices')
  async devices(@ZQuery(deviceQuery) q: z.infer<typeof deviceQuery>) {
    const where: Prisma.NfcDeviceWhereInput = {
      ...(q.security ? { securityStatus: q.security } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { publicId: { contains: q.q } }, { organization: { name: { contains: q.q, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.nfcDevice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: { id: true, publicId: true, name: true, kind: true, status: true, securityStatus: true, keyVersion: true, rejectedTaps: true, lastUsedAt: true, createdAt: true, organization: { select: { id: true, name: true } } },
      }),
      this.prisma.nfcDevice.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('abuse')
  async abuse(@ZQuery(paginationSchema) q: z.infer<typeof paginationSchema>) {
    const where = { flagged: true };
    const [items, total, byOrg] = await Promise.all([
      this.prisma.stampTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.stampTransaction.count({ where }),
      this.prisma.$queryRaw<Array<{ organizationId: string; name: string; flagged: bigint; total: bigint }>>`
        SELECT o.id AS "organizationId", o.name, COUNT(*) FILTER (WHERE t.flagged)::bigint AS flagged, COUNT(*)::bigint AS total
        FROM "StampTransaction" t JOIN "Organization" o ON o.id = t."organizationId"
        WHERE t."createdAt" >= now() - interval '30 days' AND t.type = 'EARN'
        GROUP BY o.id, o.name HAVING COUNT(*) FILTER (WHERE t.flagged) > 0 ORDER BY flagged DESC LIMIT 20`,
    ]);
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: [...new Set(items.map((i) => i.organizationId))] } }, select: { id: true, name: true } });
    return {
      items: items.map((i) => ({ ...i, organizationName: orgs.find((o) => o.id === i.organizationId)?.name ?? null })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      byOrganization: byOrg.map((r) => ({ organizationId: r.organizationId, name: r.name, flagged: n(r.flagged), total: n(r.total) })),
    };
  }

  @Get('plans')
  plans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { subscriptions: true } } } });
  }

  @Patch('plans/:id')
  async updatePlan(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @ZBody(adminUpdatePlanSchema) body: z.infer<typeof adminUpdatePlanSchema>) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw notFound('Tarif');
    const updated = await this.prisma.plan.update({ where: { id }, data: body });
    await this.log(auth, 'admin.plan_updated', { type: 'Plan', id }, body as Record<string, unknown>);
    return updated;
  }

  @Get('errors')
  async errors(@ZQuery(paginationSchema) q: z.infer<typeof paginationSchema>) {
    const [items, total] = await Promise.all([
      this.prisma.systemError.findMany({ orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.systemError.count(),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get('contact-requests')
  contactRequests() {
    return this.prisma.contactRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @Patch('contact-requests/:id')
  async handleContact(@Param('id') id: string) {
    await this.prisma.contactRequest.updateMany({ where: { id }, data: { handledAt: new Date() } });
    return { ok: true };
  }

  @Get('audit')
  async auditLog(@ZQuery(paginationSchema) q: z.infer<typeof paginationSchema>) {
    const where: Prisma.AuditLogWhereInput = q.q ? { action: { contains: q.q } } : {};
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
