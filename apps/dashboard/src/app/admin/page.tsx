'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { Badge, Card, CardBody, CardHeader, DefinitionList, defineCopy, formatMoney, formatNumber, PageHeader, Skeleton, Table, Td, Th, useCopy } from '@tably/ui';
import { deviceSecurity, deviceStatus, subscriptionStatus } from '@/lib/labels';
import { LoadError, providerLabel } from '@/components/admin/shared';
import type { AdminOverview, AdminSystem } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Übersicht',
    description: 'Der Stand der gesamten Plattform auf einen Blick.',
    orgs: 'Betriebe',
    orgsHint: (active: number, suspended: number) => `${active} aktiv · ${suspended} gesperrt`,
    users: 'Benutzer',
    customers: 'Kunden',
    activeCards: 'Aktive Karten',
    stamps: 'Stempel (30 Tage)',
    stampsHint: (n: string) => `in ${n} Buchungen`,
    flagged: 'Auffällige Buchungen (30 Tage)',
    errors: 'Fehler (24 Stunden)',
    requests: 'Offene Kontaktanfragen',
    mrr: 'Monatlicher Umsatz (MRR)',
    details: 'Ansehen',
    subsTitle: 'Abonnements',
    subsDescription: 'Nach Status und Zahlungsanbieter.',
    subsEmpty: 'Noch keine Abonnements.',
    colStatus: 'Status',
    colProvider: 'Anbieter',
    colCount: 'Anzahl',
    devicesTitle: 'NFC-Stempel',
    devicesDescription: 'Nach Gerätestatus und Sicherheitsstatus.',
    devicesEmpty: 'Noch keine Geräte registriert.',
    colDevice: 'Gerätestatus',
    colSecurity: 'Sicherheit',
    systemTitle: 'Systemstatus',
    systemDescription: 'Was eingerichtet ist – und was nicht.',
    database: 'Datenbank',
    reachable: 'Erreichbar',
    unreachable: 'Nicht erreichbar',
    queue: 'Queue-Treiber',
    mail: 'E-Mail-Versand',
    mailSmtp: 'SMTP (echter Versand)',
    mailLocal: 'Nicht eingerichtet – E-Mails werden nur lokal protokolliert',
    billing: 'Abrechnung',
    billingStripe: 'Stripe (echte Zahlungen)',
    billingLocal: 'Testmodus – kein Zahlungsanbieter, es fließt kein Geld',
    environment: 'Umgebung',
    integrationsTitle: 'Integrationen',
    configured: 'Eingerichtet',
    notConfigured: 'Nicht eingerichtet',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    stripe: 'Stripe',
    smtp: 'SMTP',
    appleWallet: 'Apple Wallet',
    googleWallet: 'Google Wallet',
    nfcSimulator: 'NFC-Simulator',
    urls: 'Adressen',
  },
});

/** Kennzahl im Stil von `Stat`, gleich hoch im Raster und optional mit Link zur Detailseite. */
function Tile({ label, value, hint, href, linkLabel }: { label: string; value: number; hint?: string; href?: string; linkLabel?: string }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular">{formatNumber(value)}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {href ? <Link href={href} className="mt-auto self-start pt-3 text-xs font-medium text-brand hover:underline" aria-label={`${label}: ${linkLabel}`}>{linkLabel} →</Link> : null}
    </Card>
  );
}

export default function AdminOverviewPage() {
  const t = useCopy(copy);
  const overview = useSWR<AdminOverview>('/admin/overview', { refreshInterval: 60_000 });
  const system = useSWR<AdminSystem>('/admin/system');
  const o = overview.data;
  const s = system.data;
  const flag = (ok: boolean, on = t.configured, off = t.notConfigured) => <Badge tone={ok ? 'success' : 'neutral'} dot>{ok ? on : off}</Badge>;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {overview.error ? (
        <Card><LoadError error={overview.error} onRetry={() => void overview.mutate()} /></Card>
      ) : !o ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile href="/admin/betriebe" linkLabel={t.details} label={t.orgs} value={(o.organizations.ACTIVE ?? 0) + (o.organizations.SUSPENDED ?? 0)} hint={t.orgsHint(o.organizations.ACTIVE ?? 0, o.organizations.SUSPENDED ?? 0)} />
            <Tile href="/admin/benutzer" linkLabel={t.details} label={t.users} value={o.users} />
            <Tile label={t.customers} value={o.customers} />
            <Tile label={t.activeCards} value={o.activeCards} />
            <Tile label={t.stamps} value={o.stamps30d.amount} hint={t.stampsHint(formatNumber(o.stamps30d.bookings))} />
            <Tile href="/admin/missbrauch" linkLabel={t.details} label={t.flagged} value={o.flagged30d} />
            <Tile href="/admin/fehler" linkLabel={t.details} label={t.errors} value={o.errors24h} />
            <Tile href="/admin/anfragen" linkLabel={t.details} label={t.requests} value={o.openContactRequests} />
          </div>

          <Card className="mt-4 p-5">
            <p className="text-sm text-muted">{t.mrr}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular">{formatMoney(o.mrrCents)}</p>
            <p className="mt-1.5 max-w-3xl text-xs text-muted">{o.mrrNote}</p>
          </Card>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title={t.subsTitle} description={t.subsDescription} />
              {o.subscriptions.length === 0 ? (
                <p className="p-5 text-sm text-muted sm:px-6">{t.subsEmpty}</p>
              ) : (
                <div className="mt-4 border-t border-line">
                  <Table>
                    <thead><tr><Th>{t.colStatus}</Th><Th>{t.colProvider}</Th><Th className="text-right">{t.colCount}</Th></tr></thead>
                    <tbody>
                      {o.subscriptions.map((row) => (
                        <tr key={`${row.status}-${row.provider}`}>
                          <Td><Badge tone={subscriptionStatus[row.status]?.tone}>{subscriptionStatus[row.status]?.label ?? row.status}</Badge></Td>
                          <Td className="text-muted">{providerLabel[row.provider] ?? row.provider}</Td>
                          <Td className="text-right font-medium tabular">{formatNumber(row.count)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title={t.devicesTitle} description={t.devicesDescription} />
              {o.devices.length === 0 ? (
                <p className="p-5 text-sm text-muted sm:px-6">{t.devicesEmpty}</p>
              ) : (
                <div className="mt-4 border-t border-line">
                  <Table>
                    <thead><tr><Th>{t.colDevice}</Th><Th>{t.colSecurity}</Th><Th className="text-right">{t.colCount}</Th></tr></thead>
                    <tbody>
                      {o.devices.map((row) => (
                        <tr key={`${row.status}-${row.securityStatus}`}>
                          <Td><Badge tone={deviceStatus[row.status]?.tone}>{deviceStatus[row.status]?.label ?? row.status}</Badge></Td>
                          <Td><Badge tone={deviceSecurity[row.securityStatus]?.tone}>{deviceSecurity[row.securityStatus]?.label ?? row.securityStatus}</Badge></Td>
                          <Td className="text-right font-medium tabular">{formatNumber(row.count)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader title={t.systemTitle} description={t.systemDescription} />
        {system.error ? (
          <LoadError error={system.error} onRetry={() => void system.mutate()} />
        ) : !s ? (
          <div className="p-5 sm:p-6"><Skeleton className="h-40 rounded-xl" /></div>
        ) : (
          <CardBody className="grid gap-x-10 gap-y-6 pt-3 lg:grid-cols-2">
            <DefinitionList
              items={[
                { label: t.database, value: <Badge tone={s.database ? 'success' : 'danger'} dot>{s.database ? t.reachable : t.unreachable}</Badge> },
                { label: t.queue, value: <code className="font-mono text-xs">{s.queueDriver}</code> },
                { label: t.mail, value: s.mailMode === 'smtp' ? t.mailSmtp : <span className="text-warn">{t.mailLocal}</span> },
                { label: t.billing, value: s.billingMode === 'stripe' ? t.billingStripe : <span className="text-warn">{t.billingLocal}</span> },
                { label: t.environment, value: <code className="font-mono text-xs">{s.environment}</code> },
              ]}
            />
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">{t.integrationsTitle}</h3>
              <DefinitionList
                className="mt-1"
                items={[
                  { label: t.stripe, value: flag(s.integrations.stripe) },
                  { label: t.smtp, value: flag(s.integrations.smtp) },
                  { label: t.appleWallet, value: flag(s.integrations.appleWallet) },
                  { label: t.googleWallet, value: flag(s.integrations.googleWallet) },
                  { label: t.nfcSimulator, value: flag(s.integrations.nfcSimulator, t.enabled, t.disabled) },
                ]}
              />
              <p className="mt-3 break-all text-xs text-muted">{t.urls}: {s.urls.web} · {s.urls.dashboard} · {s.urls.api}</p>
            </div>
          </CardBody>
        )}
      </Card>
    </>
  );
}
