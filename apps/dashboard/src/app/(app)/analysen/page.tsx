'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BarChart3, Lock } from 'lucide-react';
import type { AnalyticsDto, DeviceStatus, LocationDto, ProgramDto } from '@tapperl/types';
import { ApiError, Badge, BarChart, BarList, Card, CardBody, CardHeader, cn, defineCopy, EmptyState, ErrorState, Field, formatRelative, PageHeader, Segmented, Select, Skeleton, Stat, Table, Td, Th, useCopy, type SeriesPoint } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { deviceStatus } from '@/lib/labels';

const copy = defineCopy({
  de: {
    title: 'Analysen',
    description: 'Wie gut läuft deine Treuekarte? Hier siehst du, was in deinem Betrieb gestempelt und eingelöst wurde.',
    range: 'Zeitraum',
    days7: '7 Tage',
    days30: '30 Tage',
    days90: '90 Tage',
    range90Locked: '90 Tage sind im Business-Tarif enthalten.',
    location: 'Standort',
    allLocations: 'Alle Standorte',
    program: 'Treueprogramm',
    allPrograms: 'Alle Programme',
    errorText: 'Die Auswertung konnte nicht geladen werden.',
    updating: 'Wird aktualisiert …',
    // Kennzahlen
    kpiStamps: 'Vergebene Stempel',
    kpiRedemptions: 'Eingelöste Prämien',
    kpiActive: 'Aktive Kunden',
    kpiNew: 'Neue Kunden',
    kpiReturning: 'Wiederkehrende Kunden',
    kpiReturningHint: 'im Zeitraum aktiv und an mindestens zwei Tagen gestempelt',
    kpiRetention: 'Kundenbindung',
    retentionHint: (retained: number, base: number) => `${retained} von ${base} Kunden aus dem Vorzeitraum kamen wieder`,
    retentionNone: 'Noch nicht berechenbar',
    retentionNoneHint: 'Im Vorzeitraum hat noch niemand gestempelt – deshalb gibt es noch keinen Vergleichswert.',
    source: 'Alle Zahlen stammen direkt aus deinen Buchungen.',
    sourceMore: (total: number, tz: string) => `Nichts ist geschätzt oder hochgerechnet. Insgesamt ${total.toLocaleString('de-DE')} ${total === 1 ? 'Kunde' : 'Kunden'} · Tage nach Zeitzone ${tz}.`,
    newNotByLocation: 'Hinweis: „Neue Kunden“ lässt sich nicht nach Standort trennen und zeigt deshalb alle Standorte.',
    definitionsTitle: 'So werden die Zahlen berechnet',
    definitions: [
      ['Vergebene Stempel', 'Summe aller gutgeschriebenen Stempel im Zeitraum, inklusive Bonus- und manueller Stempel.'],
      ['Eingelöste Prämien', 'Anzahl der Einlösungen im Zeitraum.'],
      ['Aktive Kunden', 'Kunden, die im Zeitraum mindestens einmal gestempelt oder eine Prämie eingelöst haben.'],
      ['Neue Kunden', 'Kunden, die sich im Zeitraum zum ersten Mal angemeldet haben.'],
      ['Wiederkehrende Kunden', 'Kunden, die im Zeitraum gestempelt haben und insgesamt schon an mindestens zwei verschiedenen Tagen da waren.'],
      ['Kundenbindung', 'Anteil der Kunden, die im Vorzeitraum gestempelt haben und im aktuellen Zeitraum wiedergekommen sind.'],
      ['Vorzeitraum', 'Der gleich lange Zeitraum direkt davor – bei 30 Tagen also die 30 Tage davor.'],
    ] as Array<[string, string]>,
    // Diagramme
    chartTitle: 'Verlauf pro Tag',
    chartMetric: 'Kennzahl im Diagramm',
    metricStamps: 'Stempel',
    metricNew: 'Neue Kunden',
    metricActive: 'Aktive Kunden',
    chartEmpty: 'In diesem Zeitraum gibt es dazu noch keine Daten.',
    scrollHint: 'Zum Blättern seitlich wischen.',
    weekdayTitle: 'Aktivität nach Wochentag',
    weekdayText: 'Vergebene Stempel im Zeitraum, nach Wochentag zusammengezählt.',
    weekdayBest: (day: string) => `Stärkster Tag: ${day}`,
    weekdays: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    // Erweitert
    locationsTitle: 'Filialvergleich',
    locationsText: 'Vergebene Stempel je Standort im Zeitraum.',
    locationsEmpty: 'Noch keine Buchungen im Zeitraum.',
    locationHint: (customers: number, redemptions: number) => `${customers} ${customers === 1 ? 'Kunde' : 'Kunden'}, ${redemptions} ${redemptions === 1 ? 'Einlösung' : 'Einlösungen'}`,
    devicesTitle: 'Geräteaktivität',
    devicesText: 'Stempel je NFC-Stempel im Zeitraum. Abgelehnte Taps zählen seit der letzten Schlüsselerneuerung.',
    devicesEmpty: 'Noch keine Stempel registriert.',
    colDevice: 'Stempel',
    colStatus: 'Status',
    colStamps: 'Stempel',
    colRejected: 'Abgelehnte Taps',
    colLastUsed: 'Zuletzt verwendet',
    programsTitle: 'Programmeffektivität',
    programsText: 'Karten und volle Karten zählen über die gesamte Laufzeit, Stempel und Einlösungen im gewählten Zeitraum.',
    programsEmpty: 'Noch kein Treueprogramm angelegt.',
    colProgram: 'Programm',
    colCards: 'Karten',
    colActiveCards: 'Aktive Karten',
    colRedemptions: 'Einlösungen',
    colCompleted: 'Volle Karten',
    colAverage: 'Ø Stand',
    notFiltered: 'Diese Tabelle zeigt immer alle Standorte und Programme.',
    upgradeTitle: 'Mehr Auswertungen im Business-Tarif',
    upgradeText: 'Filialvergleich, Geräteaktivität, Programmeffektivität und der 90-Tage-Zeitraum sind im Business-Tarif enthalten.',
    upgradeLink: 'Tarife ansehen',
    unitStamps: 'Stempel',
    unitCustomers: 'Kunden',
  },
});

type Days = '7' | '30' | '90';
type Metric = 'stamps' | 'newCustomers' | 'activeCustomers';
const dayLabel = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const dayTitle = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

function LoadingState() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-80 rounded-2xl" />
    </>
  );
}

export default function AnalyticsPage() {
  const t = useCopy(copy);
  const { me } = useSession();
  const planAdvanced = Boolean(me.subscription?.features.advancedAnalytics);
  const [days, setDays] = React.useState<Days>('30');
  const [locationId, setLocationId] = React.useState('');
  const [programId, setProgramId] = React.useState('');
  const [metric, setMetric] = React.useState<Metric>('stamps');

  const locations = useSWR<LocationDto[]>('/organization/locations');
  const programs = useSWR<ProgramDto[]>('/programs');
  const query = new URLSearchParams({ days });
  if (locationId) query.set('locationId', locationId);
  if (programId) query.set('programId', programId);
  const overview = useSWR<AnalyticsDto, ApiError>(`/analytics/overview?${query.toString()}`, { keepPreviousData: true });

  const data = overview.data;
  const advanced = data ? data.advanced : planAdvanced;
  // Fällt der Tarif zurück, während 90 Tage gewählt sind, auf 30 Tage wechseln.
  React.useEffect(() => {
    if (!advanced && days === '90') setDays('30');
  }, [advanced, days]);

  const rangeOptions: Array<{ value: Days; label: string }> = [
    { value: '7', label: t.days7 },
    { value: '30', label: t.days30 },
    ...(advanced ? [{ value: '90' as const, label: t.days90 }] : []),
  ];
  const filtered = Boolean(locationId || programId);

  const series: SeriesPoint[] = React.useMemo(
    () =>
      (data?.series ?? []).map((row) => {
        const date = new Date(`${row.day}T00:00:00Z`);
        return { label: dayLabel.format(date), title: dayTitle.format(date), value: row[metric] };
      }),
    [data, metric],
  );
  const seriesEmpty = series.every((p) => p.value === 0);
  const metricUnit = metric === 'stamps' ? t.unitStamps : metric === 'newCustomers' ? t.metricNew : t.metricActive;
  const weekdayData: SeriesPoint[] = (data?.weekdays ?? []).map((w) => ({ label: t.weekdaysShort[w.weekday - 1] ?? String(w.weekday), title: t.weekdays[w.weekday - 1] ?? String(w.weekday), value: w.stamps }));
  const bestWeekday = (data?.weekdays ?? []).reduce<{ weekday: number; stamps: number } | null>((best, w) => (w.stamps > (best?.stamps ?? 0) ? w : best), null);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink" id="range-label">
            {t.range}
          </p>
          <Segmented<Days> label={t.range} value={days} onChange={setDays} options={rangeOptions} />
          {!advanced ? <p className="mt-1.5 text-xs text-muted">{t.range90Locked}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:w-[30rem]">
          <Field label={t.location}>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!locations.data}>
              <option value="">{t.allLocations}</option>
              {(locations.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.program}>
            <Select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!programs.data}>
              <option value="">{t.allPrograms}</option>
              {(programs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {overview.error && !overview.isValidating ? (
        <Card>
          <ErrorState description={overview.error.code === 'feature_not_in_plan' ? overview.error.message : t.errorText} onRetry={() => void overview.mutate()} />
        </Card>
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className={cn('transition-opacity', overview.isValidating && String(data.range.days) !== days ? 'opacity-60' : '')} aria-busy={overview.isValidating}>
          <span className="sr-only" role="status">
            {overview.isValidating ? t.updating : ''}
          </span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label={t.kpiStamps} value={data.kpis.stamps.current} previous={data.kpis.stamps.previous} />
            <Stat label={t.kpiRedemptions} value={data.kpis.redemptions.current} previous={data.kpis.redemptions.previous} />
            <Stat label={t.kpiActive} value={data.kpis.activeCustomers.current} previous={data.kpis.activeCustomers.previous} />
            <Stat label={t.kpiNew} value={data.kpis.newCustomers.current} previous={data.kpis.newCustomers.previous} />
            <Stat label={t.kpiReturning} value={data.kpis.returningCustomers.current} hint={t.kpiReturningHint} />
            {data.kpis.retentionRate === null ? (
              <Stat
                label={t.kpiRetention}
                value="–"
                hint={
                  <>
                    <strong className="font-medium text-ink">{t.retentionNone}.</strong> {t.retentionNoneHint}
                  </>
                }
              />
            ) : (
              <Stat label={t.kpiRetention} value={`${Math.round(data.kpis.retentionRate * 100)} %`} hint={t.retentionHint(Math.round(data.kpis.retentionRate * data.kpis.retentionBase), data.kpis.retentionBase)} />
            )}
          </div>
          <p className="mt-3 text-sm text-muted">
            <strong className="font-medium text-ink">{t.source}</strong> {t.sourceMore(data.kpis.totalCustomers, data.range.timezone)}
          </p>
          {locationId ? <p className="mt-1 text-sm text-muted">{t.newNotByLocation}</p> : null}
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-medium text-brand hover:underline">{t.definitionsTitle}</summary>
            <dl className="mt-3 grid gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
              {t.definitions.map(([term, text]) => (
                <div key={term}>
                  <dt className="font-medium text-ink">{term}</dt>
                  <dd className="text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </details>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader title={t.chartTitle} className="flex-col sm:flex-row" action={<Segmented<Metric> size="sm" label={t.chartMetric} value={metric} onChange={setMetric} options={[{ value: 'stamps', label: t.metricStamps }, { value: 'newCustomers', label: t.metricNew }, { value: 'activeCustomers', label: t.metricActive }]} />} />
              <CardBody>
                {seriesEmpty ? (
                  <EmptyState icon={<BarChart3 />} title={t.chartEmpty} className="py-10" />
                ) : (
                  <>
                    <div className={series.length > 31 ? 'overflow-x-auto pt-3' : 'pt-3'}>
                      <BarChart data={series} unit={metricUnit} className={series.length > 31 ? 'min-w-[720px]' : undefined} />
                    </div>
                    {series.length > 31 ? <p className="mt-2 text-xs text-subtle lg:hidden">{t.scrollHint}</p> : null}
                  </>
                )}
              </CardBody>
            </Card>
            <Card className="min-w-0">
              <CardHeader title={t.weekdayTitle} description={t.weekdayText} />
              <CardBody>
                {weekdayData.every((w) => w.value === 0) ? (
                  <EmptyState title={t.chartEmpty} className="py-10" />
                ) : (
                  <>
                    <div className="pt-3">
                      <BarChart data={weekdayData} unit={t.unitStamps} height={180} color="var(--honey)" />
                    </div>
                    {bestWeekday ? <p className="mt-3 text-sm text-muted">{t.weekdayBest(t.weekdays[bestWeekday.weekday - 1] ?? '')}</p> : null}
                  </>
                )}
              </CardBody>
            </Card>
          </div>

          {data.advanced ? (
            <div className="mt-6 flex flex-col gap-6">
              <Card>
                <CardHeader title={t.locationsTitle} description={t.locationsText} />
                <CardBody>{data.locations.length === 0 ? <p className="text-sm text-muted">{t.locationsEmpty}</p> : <BarList unit={t.unitStamps} items={data.locations.map((l) => ({ label: `${l.name} · ${t.locationHint(l.activeCustomers, l.redemptions)}`, value: l.stamps }))} />}</CardBody>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader title={t.devicesTitle} description={`${t.devicesText}${filtered ? ` ${t.notFiltered}` : ''}`} />
                {data.devices.length === 0 ? (
                  <CardBody>
                    <p className="text-sm text-muted">{t.devicesEmpty}</p>
                  </CardBody>
                ) : (
                  <div className="mt-3">
                    <Table>
                      <thead>
                        <tr>
                          <Th>{t.colDevice}</Th>
                          <Th>{t.colStatus}</Th>
                          <Th className="text-right">{t.colStamps}</Th>
                          <Th className="text-right">{t.colRejected}</Th>
                          <Th>{t.colLastUsed}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.devices.map((d) => {
                          const status = deviceStatus[d.status as DeviceStatus];
                          return (
                            <tr key={d.id}>
                              <Td className="font-medium">{d.name}</Td>
                              <Td>{status ? <Badge tone={status.tone}>{status.label}</Badge> : d.status}</Td>
                              <Td className="text-right tabular">{d.stamps.toLocaleString('de-DE')}</Td>
                              <Td className={cn('text-right tabular', d.rejectedTaps > 0 ? 'text-warn' : 'text-muted')}>{d.rejectedTaps.toLocaleString('de-DE')}</Td>
                              <Td className="whitespace-nowrap text-muted">{formatRelative(d.lastUsedAt)}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card>

              <Card className="overflow-hidden">
                <CardHeader title={t.programsTitle} description={`${t.programsText}${filtered ? ` ${t.notFiltered}` : ''}`} />
                {data.programs.length === 0 ? (
                  <CardBody>
                    <p className="text-sm text-muted">{t.programsEmpty}</p>
                  </CardBody>
                ) : (
                  <div className="mt-3">
                    <Table>
                      <thead>
                        <tr>
                          <Th>{t.colProgram}</Th>
                          <Th className="text-right">{t.colCards}</Th>
                          <Th className="text-right">{t.colActiveCards}</Th>
                          <Th className="text-right">{t.colStamps}</Th>
                          <Th className="text-right">{t.colRedemptions}</Th>
                          <Th className="text-right">{t.colCompleted}</Th>
                          <Th className="text-right">{t.colAverage}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.programs.map((p) => (
                          <tr key={p.id}>
                            <Td className="font-medium">{p.name}</Td>
                            <Td className="text-right tabular">{p.cards.toLocaleString('de-DE')}</Td>
                            <Td className="text-right tabular">{p.activeCards.toLocaleString('de-DE')}</Td>
                            <Td className="text-right tabular">{p.stamps.toLocaleString('de-DE')}</Td>
                            <Td className="text-right tabular">{p.redemptions.toLocaleString('de-DE')}</Td>
                            <Td className="text-right tabular">{p.completedCards.toLocaleString('de-DE')}</Td>
                            <Td className="text-right tabular">{p.averageBalance.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed border-line-strong p-5 text-sm sm:flex-row sm:items-center">
              <Lock className="size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{t.upgradeTitle}</p>
                <p className="text-muted">{t.upgradeText}</p>
              </div>
              <Link href="/einstellungen?tab=abo" className="shrink-0 font-medium text-brand hover:underline">
                {t.upgradeLink}
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
