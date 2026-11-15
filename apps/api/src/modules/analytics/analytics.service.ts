import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '../../common/prisma.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { AppError } from '../../common/errors';
import type { TenantContext } from '../../common/auth.types';

export interface AnalyticsQuery {
  days: 7 | 30 | 90;
  locationId?: string;
  programId?: string;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * Alle Kennzahlen werden direkt aus Buchungen und Kundendaten berechnet.
 * Es gibt keine geschätzten oder hochgerechneten Werte – insbesondere keinen
 * Umsatz, weil Tably keine Umsätze kennt.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async overview(ctx: TenantContext, query: AnalyticsQuery) {
    const organizationId = ctx.organizationId;
    const eff = await this.entitlements.get(organizationId);
    const advanced = eff.features.advancedAnalytics;
    if (!advanced && query.days === 90) throw new AppError('feature_not_in_plan', 'Der 90-Tage-Zeitraum ist in deinem Tarif nicht enthalten.');
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
    const tz = org.timezone;
    const days = query.days;

    const txFilter = Prisma.sql`t."organizationId" = ${organizationId}
      ${query.locationId ? Prisma.sql`AND t."locationId" = ${query.locationId}` : Prisma.empty}
      ${query.programId ? Prisma.sql`AND t."programId" = ${query.programId}` : Prisma.empty}`;
    // Zeitraum: die letzten `days` Kalendertage in der Zeitzone des Betriebs, inklusive heute
    const startSql = Prisma.sql`((date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days - 1})) AT TIME ZONE ${tz})`;
    const prevStartSql = Prisma.sql`((date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days * 2 - 1})) AT TIME ZONE ${tz})`;

    const [kpiRows, customerRows, retentionRows, returningRows, series, newSeries, weekdayRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ period: string; stamps: bigint; bookings: bigint; redemptions: bigint; active: bigint }>>`
        SELECT CASE WHEN t."createdAt" >= ${startSql} THEN 'current' ELSE 'previous' END AS period,
               COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EARN'), 0)::bigint AS stamps,
               COUNT(*) FILTER (WHERE t.type = 'EARN')::bigint AS bookings,
               COUNT(*) FILTER (WHERE t.type = 'REDEEM')::bigint AS redemptions,
               COUNT(DISTINCT t."customerId") FILTER (WHERE t.type IN ('EARN','REDEEM'))::bigint AS active
        FROM "StampTransaction" t WHERE ${txFilter} AND t."createdAt" >= ${prevStartSql}
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ total: bigint; current: bigint; previous: bigint }>>`
        SELECT COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE c."createdAt" >= ${startSql})::bigint AS current,
               COUNT(*) FILTER (WHERE c."createdAt" >= ${prevStartSql} AND c."createdAt" < ${startSql})::bigint AS previous
        FROM "Customer" c WHERE c."organizationId" = ${organizationId} AND c.status <> 'ANONYMIZED'
          ${query.programId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "LoyaltyCard" lc WHERE lc."customerId" = c.id AND lc."programId" = ${query.programId})` : Prisma.empty}`,
      // Kundenbindung: Anteil der im Vorzeitraum aktiven Kunden, die im aktuellen Zeitraum wiederkamen
      this.prisma.$queryRaw<Array<{ previous: bigint; retained: bigint }>>`
        WITH prev AS (SELECT DISTINCT t."customerId" FROM "StampTransaction" t WHERE ${txFilter} AND t.type = 'EARN' AND t."createdAt" >= ${prevStartSql} AND t."createdAt" < ${startSql}),
             cur AS (SELECT DISTINCT t."customerId" FROM "StampTransaction" t WHERE ${txFilter} AND t.type = 'EARN' AND t."createdAt" >= ${startSql})
        SELECT (SELECT COUNT(*) FROM prev)::bigint AS previous, (SELECT COUNT(*) FROM prev JOIN cur USING ("customerId"))::bigint AS retained`,
      // Wiederkehrend: im Zeitraum aktiv UND an mindestens zwei verschiedenen Tagen überhaupt gestempelt
      this.prisma.$queryRaw<Array<{ returning: bigint }>>`
        SELECT COUNT(*)::bigint AS returning FROM (
          SELECT t."customerId" FROM "StampTransaction" t WHERE ${txFilter} AND t.type = 'EARN'
          GROUP BY t."customerId"
          HAVING COUNT(DISTINCT (t."createdAt" AT TIME ZONE ${tz})::date) >= 2 AND MAX(t."createdAt") >= ${startSql}
        ) x`,
      this.prisma.$queryRaw<Array<{ day: string; stamps: bigint; redemptions: bigint; active: bigint }>>`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
               COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EARN'), 0)::bigint AS stamps,
               COUNT(t.id) FILTER (WHERE t.type = 'REDEEM')::bigint AS redemptions,
               COUNT(DISTINCT t."customerId") FILTER (WHERE t.type IN ('EARN','REDEEM'))::bigint AS active
        FROM generate_series(date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${days - 1}), date_trunc('day', now() AT TIME ZONE ${tz}), interval '1 day') AS d(day)
        LEFT JOIN "StampTransaction" t ON ${txFilter} AND (t."createdAt" AT TIME ZONE ${tz})::date = d.day::date
        GROUP BY d.day ORDER BY d.day`,
      this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT to_char((c."createdAt" AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
        FROM "Customer" c WHERE c."organizationId" = ${organizationId} AND c.status <> 'ANONYMIZED' AND c."createdAt" >= ${startSql}
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ weekday: number; stamps: bigint }>>`
        SELECT EXTRACT(ISODOW FROM t."createdAt" AT TIME ZONE ${tz})::int AS weekday, COALESCE(SUM(t.amount), 0)::bigint AS stamps
        FROM "StampTransaction" t WHERE ${txFilter} AND t.type = 'EARN' AND t."createdAt" >= ${startSql}
        GROUP BY 1 ORDER BY 1`,
    ]);

    const kpi = (period: string) => kpiRows.find((r) => r.period === period);
    const cur = kpi('current');
    const prev = kpi('previous');
    const retention = retentionRows[0];
    const newByDay = new Map(newSeries.map((r) => [r.day, n(r.count)]));

    const result = {
      range: { days, timezone: tz },
      advanced,
      kpis: {
        stamps: { current: n(cur?.stamps), previous: n(prev?.stamps) },
        bookings: { current: n(cur?.bookings), previous: n(prev?.bookings) },
        redemptions: { current: n(cur?.redemptions), previous: n(prev?.redemptions) },
        activeCustomers: { current: n(cur?.active), previous: n(prev?.active) },
        newCustomers: { current: n(customerRows[0]?.current), previous: n(customerRows[0]?.previous) },
        returningCustomers: { current: n(returningRows[0]?.returning) },
        totalCustomers: n(customerRows[0]?.total),
        /** null, wenn es im Vorzeitraum keine aktiven Kunden gab */
        retentionRate: n(retention?.previous) > 0 ? n(retention?.retained) / n(retention?.previous) : null,
        retentionBase: n(retention?.previous),
      },
      series: series.map((r) => ({ day: r.day, stamps: n(r.stamps), redemptions: n(r.redemptions), activeCustomers: n(r.active), newCustomers: newByDay.get(r.day) ?? 0 })),
      weekdays: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, stamps: n(weekdayRows.find((r) => r.weekday === weekday)?.stamps) })),
      locations: [] as Array<{ id: string | null; name: string; stamps: number; redemptions: number; activeCustomers: number }>,
      devices: [] as Array<{ id: string; name: string; status: string; stamps: number; rejectedTaps: number; lastUsedAt: Date | null }>,
      programs: [] as Array<{ id: string; name: string; cards: number; activeCards: number; stamps: number; redemptions: number; completedCards: number; averageBalance: number }>,
    };
    if (!advanced) return result;

    const [locationRows, deviceRows, programRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string | null; name: string | null; stamps: bigint; redemptions: bigint; active: bigint }>>`
        SELECT l.id, l.name, COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EARN'), 0)::bigint AS stamps,
               COUNT(t.id) FILTER (WHERE t.type = 'REDEEM')::bigint AS redemptions,
               COUNT(DISTINCT t."customerId")::bigint AS active
        FROM "StampTransaction" t LEFT JOIN "Location" l ON l.id = t."locationId"
        WHERE ${txFilter} AND t."createdAt" >= ${startSql} AND t.type IN ('EARN','REDEEM')
        GROUP BY l.id, l.name ORDER BY stamps DESC`,
      this.prisma.$queryRaw<Array<{ id: string; name: string; status: string; rejectedTaps: number; lastUsedAt: Date | null; stamps: bigint }>>`
        SELECT d.id, d.name, d.status::text AS status, d."rejectedTaps", d."lastUsedAt",
               COALESCE((SELECT SUM(t.amount) FROM "StampTransaction" t WHERE t."deviceId" = d.id AND t.type = 'EARN' AND t."createdAt" >= ${startSql}), 0)::bigint AS stamps
        FROM "NfcDevice" d WHERE d."organizationId" = ${organizationId} AND d.status <> 'RETIRED' ORDER BY stamps DESC`,
      this.prisma.$queryRaw<Array<{ id: string; name: string; cards: bigint; active_cards: bigint; completed: bigint; avg_balance: number | null; stamps: bigint; redemptions: bigint }>>`
        SELECT p.id, p.name,
               (SELECT COUNT(*) FROM "LoyaltyCard" c WHERE c."programId" = p.id)::bigint AS cards,
               (SELECT COUNT(*) FROM "LoyaltyCard" c WHERE c."programId" = p.id AND c."lastStampAt" >= ${startSql})::bigint AS active_cards,
               (SELECT COUNT(*) FROM "LoyaltyCard" c WHERE c."programId" = p.id AND c."lifetimeEarned" >= p."stampsRequired")::bigint AS completed,
               (SELECT AVG(c.balance)::float FROM "LoyaltyCard" c WHERE c."programId" = p.id) AS avg_balance,
               COALESCE((SELECT SUM(t.amount) FROM "StampTransaction" t WHERE t."programId" = p.id AND t.type = 'EARN' AND t."createdAt" >= ${startSql}), 0)::bigint AS stamps,
               (SELECT COUNT(*) FROM "StampTransaction" t WHERE t."programId" = p.id AND t.type = 'REDEEM' AND t."createdAt" >= ${startSql})::bigint AS redemptions
        FROM "LoyaltyProgram" p WHERE p."organizationId" = ${organizationId} AND p.status <> 'ARCHIVED' ORDER BY p."createdAt"`,
    ]);
    result.locations = locationRows.map((r) => ({ id: r.id, name: r.name ?? 'Ohne Standort', stamps: n(r.stamps), redemptions: n(r.redemptions), activeCustomers: n(r.active) }));
    result.devices = deviceRows.map((r) => ({ id: r.id, name: r.name, status: r.status, stamps: n(r.stamps), rejectedTaps: r.rejectedTaps, lastUsedAt: r.lastUsedAt }));
    result.programs = programRows.map((r) => ({ id: r.id, name: r.name, cards: n(r.cards), activeCards: n(r.active_cards), stamps: n(r.stamps), redemptions: n(r.redemptions), completedCards: n(r.completed), averageBalance: Math.round((r.avg_balance ?? 0) * 10) / 10 }));
    return result;
  }

  /** Kompakte Übersicht für die Startseite des Dashboards. */
  async today(ctx: TenantContext) {
    const organizationId = ctx.organizationId;
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
    const tz = org.timezone;
    const [rows, pendingTaps, flagged, recent] = await Promise.all([
      this.prisma.$queryRaw<Array<{ stamps: bigint; redemptions: bigint; customers: bigint }>>`
        SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'EARN'), 0)::bigint AS stamps,
               COUNT(*) FILTER (WHERE type = 'REDEEM')::bigint AS redemptions,
               COUNT(DISTINCT "customerId")::bigint AS customers
        FROM "StampTransaction" WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= (date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`,
      this.prisma.tapEvent.count({ where: { organizationId, status: { in: ['PENDING_APPROVAL', 'PENDING_POS'] }, expiresAt: { gt: new Date() } } }),
      this.prisma.stampTransaction.count({ where: { organizationId, flagged: true, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
      this.prisma.stampTransaction.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, type: true, source: true, amount: true, createdAt: true, flagged: true, card: { select: { customer: { select: { id: true, firstName: true, lastName: true } } } } },
      }),
    ]);
    return {
      today: { stamps: n(rows[0]?.stamps), redemptions: n(rows[0]?.redemptions), customers: n(rows[0]?.customers) },
      pendingTaps,
      flagged7d: flagged,
      recent: recent.map(({ card, ...t }) => ({ ...t, customer: card.customer })),
    };
  }
}
