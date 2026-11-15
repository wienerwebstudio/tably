'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft } from 'lucide-react';
import { Alert, ApiError, Badge, Card, CardBody, CardHeader, DefinitionList, defineCopy, ErrorState, formatDate, formatDateTime, formatMoney, formatRelative, PageHeader, Skeleton, Stat, Table, Td, Th, useCopy } from '@tapperl/ui';
import { deviceKind, deviceSecurity, deviceStatus, industryLabel, limitLabel, policyLabel, programStatus, roleLabel, subscriptionStatus } from '@/lib/labels';
import { UsageBar } from '@/components/settings/shared';
import { actorLabel, auditLabel, LoadError, orgStatus, providerLabel } from '@/components/admin/shared';
import { LimitOverridesForm, SubscriptionForm, SuspendButton, useOrgPatch } from '@/components/admin/org-actions';
import { LIMIT_KEYS, type AdminOrgDetail, type AdminPlan } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    back: 'Alle Betriebe',
    notFoundTitle: 'Betrieb nicht gefunden',
    notFoundText: 'Diesen Betrieb gibt es nicht (mehr).',
    suspendedTitle: 'Dieser Betrieb ist gesperrt',
    noReason: 'Keine Begründung hinterlegt.',
    stamps: 'Stempel-Buchungen (30 Tage)',
    flagged: 'Auffällige Buchungen (30 Tage)',
    customers: 'Kunden',
    infoTitle: 'Stammdaten',
    slug: 'Kürzel',
    industry: 'Branche',
    email: 'E-Mail',
    phone: 'Telefon',
    address: 'Adresse',
    timezone: 'Zeitzone',
    created: 'Angelegt am',
    subTitle: 'Abonnement',
    noSub: 'Für diesen Betrieb gibt es kein Abonnement.',
    plan: 'Tarif',
    status: 'Status',
    provider: 'Anbieter',
    interval: 'Abrechnung',
    monthly: 'monatlich',
    yearly: 'jährlich',
    trialEnds: 'Testphase endet am',
    periodEnd: 'Zeitraum endet am',
    cancelAtEnd: 'Kündigung vorgemerkt',
    yes: 'Ja',
    no: 'Nein',
    usageTitle: 'Nutzung und Limits',
    usageDescription: 'Gegenüber den tatsächlich geltenden Limits (Tarif plus individuelle Überschreibungen).',
    membersTitle: 'Mitglieder',
    colName: 'Name',
    colRole: 'Rolle',
    colLastLogin: 'Letzte Anmeldung',
    never: 'noch nie',
    disabled: 'Gesperrt',
    programsTitle: 'Treueprogramme',
    programsEmpty: 'Noch keine Treueprogramme.',
    colProgram: 'Programm',
    colPolicy: 'Buchungsart',
    colStatus: 'Status',
    devicesTitle: 'NFC-Stempel',
    devicesEmpty: 'Noch keine Geräte.',
    colDevice: 'Gerät',
    colSecurity: 'Sicherheit',
    colRejected: 'Abgelehnte Taps',
    colLastUsed: 'Zuletzt genutzt',
    invoicesTitle: 'Rechnungen',
    invoicesEmpty: 'Noch keine Rechnungen.',
    testInvoice: 'Testmodus – keine Zahlung',
    auditTitle: 'Protokoll (letzte 30 Einträge)',
    auditEmpty: 'Noch keine Einträge.',
    colAction: 'Aktion',
    colActor: 'Akteur',
    colTime: 'Zeitpunkt',
  },
});

export default function AdminOrganizationPage() {
  const t = useCopy(copy);
  const { id } = useParams<{ id: string }>();
  const detail = useSWR<AdminOrgDetail, ApiError>(`/admin/organizations/${id}`);
  const plans = useSWR<AdminPlan[]>('/admin/plans');
  const { mutate } = detail;
  const patch = useOrgPatch(id, React.useCallback((next: AdminOrgDetail) => void mutate(next, { revalidate: false }), [mutate]));
  const back = <Link href="/admin/betriebe" className="inline-flex items-center gap-1.5 text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{t.back}</Link>;

  if (detail.error) {
    return (
      <>
        <PageHeader title={t.notFoundTitle} back={back} />
        <Card>{detail.error.status === 404 ? <ErrorState title={t.notFoundTitle} description={t.notFoundText} /> : <LoadError error={detail.error} onRetry={() => void detail.mutate()} />}</Card>
      </>
    );
  }
  if (!detail.data) {
    return (
      <>
        <div className="mb-8"><Skeleton className="h-8 w-64" /></div>
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="mt-6 h-96 rounded-2xl" />
      </>
    );
  }

  const d = detail.data;
  const org = d.organization;
  const sub = org.subscription;
  const address = [org.addressLine, [org.postalCode, org.city].filter(Boolean).join(' '), org.country].filter(Boolean).join(', ');

  return (
    <>
      <PageHeader
        back={back}
        title={<span className="flex flex-wrap items-center gap-3"><span className="break-words">{org.name}</span><Badge tone={orgStatus[org.status]?.tone}>{orgStatus[org.status]?.label ?? org.status}</Badge></span>}
        actions={<SuspendButton detail={d} patch={patch} />}
      />
      {org.status === 'SUSPENDED' ? <Alert tone="danger" title={t.suspendedTitle} className="mb-6">{org.suspendedReason ?? t.noReason}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t.stamps} value={d.stamps30d} />
        <Stat label={t.flagged} value={d.flagged30d} />
        <Stat label={t.customers} value={d.usage.customers} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.infoTitle} />
          <CardBody className="pt-3">
            <DefinitionList
              items={[
                { label: t.slug, value: <code className="break-all font-mono text-xs">{org.slug}</code> },
                { label: t.industry, value: industryLabel[org.industry] ?? org.industry },
                { label: t.email, value: <span className="break-all">{org.email ?? '–'}</span> },
                { label: t.phone, value: org.phone ?? '–' },
                { label: t.address, value: address || '–' },
                { label: t.timezone, value: org.timezone },
                { label: t.created, value: formatDate(org.createdAt) },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.subTitle} />
          <CardBody className="pt-3">
            {!sub ? (
              <p className="text-sm text-muted">{t.noSub}</p>
            ) : (
              <DefinitionList
                items={[
                  { label: t.plan, value: sub.plan.name },
                  { label: t.status, value: <Badge tone={subscriptionStatus[sub.status]?.tone} dot>{subscriptionStatus[sub.status]?.label ?? sub.status}</Badge> },
                  { label: t.provider, value: providerLabel[sub.provider] ?? sub.provider },
                  { label: t.interval, value: sub.interval === 'YEAR' ? t.yearly : t.monthly },
                  { label: t.trialEnds, value: formatDate(sub.trialEndsAt) },
                  { label: t.periodEnd, value: formatDate(sub.currentPeriodEnd) },
                  { label: t.cancelAtEnd, value: sub.cancelAtPeriodEnd ? t.yes : t.no },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader title={t.usageTitle} description={t.usageDescription} />
          <CardBody className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIMIT_KEYS.map((key) => <UsageBar key={key} label={limitLabel[key] ?? key} used={d.usage[key]} limit={d.limits[key]} />)}
          </CardBody>
        </Card>

        {sub ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {plans.error ? <Card><LoadError error={plans.error} onRetry={() => void plans.mutate()} /></Card> : !plans.data ? <Skeleton className="h-72 rounded-2xl" /> : <SubscriptionForm detail={d} plans={plans.data} patch={patch} />}
            <LimitOverridesForm detail={d} patch={patch} />
          </div>
        ) : null}

        <Card>
          <CardHeader title={`${t.membersTitle} (${org.members.length})`} />
          <div className="mt-4 border-t border-line">
            <Table>
              <thead><tr><Th>{t.colName}</Th><Th>{t.colRole}</Th><Th>{t.colLastLogin}</Th></tr></thead>
              <tbody>
                {org.members.map((m) => (
                  <tr key={m.id}>
                    <Td className="min-w-48">
                      <p className="flex flex-wrap items-center gap-2 font-medium">{m.user.name}{m.user.disabledAt ? <Badge tone="danger">{t.disabled}</Badge> : null}</p>
                      <p className="break-all text-muted">{m.user.email}</p>
                    </Td>
                    <Td className="whitespace-nowrap">{roleLabel[m.role] ?? m.role}</Td>
                    <Td className="whitespace-nowrap text-muted">{m.user.lastLoginAt ? formatRelative(m.user.lastLoginAt) : t.never}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={`${t.programsTitle} (${org.programs.length})`} />
            {org.programs.length === 0 ? (
              <p className="p-5 text-sm text-muted sm:px-6">{t.programsEmpty}</p>
            ) : (
              <div className="mt-4 border-t border-line">
                <Table>
                  <thead><tr><Th>{t.colProgram}</Th><Th>{t.colPolicy}</Th><Th>{t.colStatus}</Th></tr></thead>
                  <tbody>
                    {org.programs.map((p) => (
                      <tr key={p.id}>
                        <Td className="min-w-40 font-medium">{p.name}</Td>
                        <Td className="text-muted">{policyLabel[p.bookingPolicy]?.label ?? p.bookingPolicy}</Td>
                        <Td><Badge tone={programStatus[p.status]?.tone}>{programStatus[p.status]?.label ?? p.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title={`${t.devicesTitle} (${org.devices.length})`} />
            {org.devices.length === 0 ? (
              <p className="p-5 text-sm text-muted sm:px-6">{t.devicesEmpty}</p>
            ) : (
              <div className="mt-4 border-t border-line">
                <Table>
                  <thead><tr><Th>{t.colDevice}</Th><Th>{t.colStatus}</Th><Th>{t.colSecurity}</Th><Th className="text-right">{t.colRejected}</Th></tr></thead>
                  <tbody>
                    {org.devices.map((dev) => (
                      <tr key={dev.id}>
                        <Td className="min-w-44">
                          <p className="font-medium">{dev.name}</p>
                          <p className="text-xs text-muted">{deviceKind[dev.kind] ?? dev.kind} · {t.colLastUsed.toLowerCase()} {formatRelative(dev.lastUsedAt)}</p>
                        </Td>
                        <Td><Badge tone={deviceStatus[dev.status]?.tone}>{deviceStatus[dev.status]?.label ?? dev.status}</Badge></Td>
                        <Td><Badge tone={deviceSecurity[dev.securityStatus]?.tone}>{deviceSecurity[dev.securityStatus]?.label ?? dev.securityStatus}</Badge></Td>
                        <Td className="text-right tabular">{dev.rejectedTaps}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title={t.invoicesTitle} />
          {d.invoices.length === 0 ? (
            <p className="p-5 text-sm text-muted sm:px-6">{t.invoicesEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {d.invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm sm:px-6">
                  <span className="font-medium">{inv.number}</span>
                  <span className="text-muted">{formatDate(inv.createdAt)}</span>
                  {inv.isTest ? <Badge tone="honey">{t.testInvoice}</Badge> : <Badge>{inv.status}</Badge>}
                  <span className="ml-auto tabular">{formatMoney(inv.amountCents, inv.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t.auditTitle} />
          {d.audit.length === 0 ? (
            <p className="p-5 text-sm text-muted sm:px-6">{t.auditEmpty}</p>
          ) : (
            <div className="mt-4 border-t border-line">
              <Table>
                <thead><tr><Th>{t.colAction}</Th><Th>{t.colActor}</Th><Th>{t.colTime}</Th></tr></thead>
                <tbody>
                  {d.audit.map((entry) => (
                    <tr key={entry.id}>
                      <Td className="min-w-44 font-medium">{auditLabel(entry.action)}</Td>
                      <Td className="text-muted">{actorLabel[entry.actorType] ?? entry.actorType}</Td>
                      <Td className="whitespace-nowrap text-muted tabular">{formatDateTime(entry.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
