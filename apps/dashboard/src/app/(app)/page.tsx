'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, Check, Flag, Hourglass } from 'lucide-react';
import type { OnboardingDto, TodayDto } from '@tapperl/types';
import { Badge, buttonClass, Card, CardBody, CardHeader, cn, EmptyState, ErrorState, formatRelative, fullName, PageHeader, Skeleton, Stat } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { txSource, txType } from '@/lib/labels';

const STEP_LABELS: Record<OnboardingDto['steps'][number]['key'], { title: string; href: string }> = {
  company: { title: 'Betrieb einrichten', href: '/onboarding' },
  program: { title: 'Treuekarte gestalten', href: '/onboarding' },
  reward: { title: 'Prämie festlegen', href: '/onboarding' },
  publish: { title: 'Karte veröffentlichen', href: '/onboarding' },
  device: { title: 'NFC-Stempel registrieren', href: '/onboarding' },
  test: { title: 'Ersten Stempel testen', href: '/onboarding' },
};

function SetupCard({ data }: { data: OnboardingDto }) {
  const done = data.steps.filter((s) => s.done).length;
  return (
    <Card className="mb-8 overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand">Einrichtung · {done} von {data.steps.length} Schritten</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">In wenigen Minuten startklar</h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.steps.map((step) => (
              <li key={step.key} className="flex items-center gap-2.5 text-sm">
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', step.done ? 'bg-success text-white' : 'border border-line-strong')} aria-hidden>
                  {step.done ? <Check className="size-3" /> : null}
                </span>
                <span className={step.done ? 'text-muted line-through' : 'text-ink'}>{STEP_LABELS[step.key].title}</span>
                <span className="sr-only">{step.done ? '(erledigt)' : '(offen)'}</span>
              </li>
            ))}
          </ol>
        </div>
        <Link href="/onboarding" className={buttonClass({ size: 'lg', className: 'shrink-0' })}>
          Einrichtung fortsetzen <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="h-1 bg-sunken" aria-hidden>
        <div className="h-full bg-brand transition-[width]" style={{ width: `${(done / data.steps.length) * 100}%` }} />
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { me, can } = useSession();
  const today = useSWR<TodayDto>('/analytics/today', { refreshInterval: 30_000 });
  const onboarding = useSWR<OnboardingDto>('/organization/onboarding');
  const firstName = me.user.name.split(' ')[0];

  return (
    <>
      <PageHeader title={`Hallo ${firstName}`} description="Das ist heute in deinem Betrieb passiert." actions={can('stamps.grant') ? <Link href="/theke" className={buttonClass({})}>Zur Theke</Link> : undefined} />
      {onboarding.data && !onboarding.data.allDone && can('org.manage') ? <SetupCard data={onboarding.data} /> : null}

      {today.error ? (
        <Card><ErrorState onRetry={() => void today.mutate()} /></Card>
      ) : !today.data ? (
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Stempel heute" value={today.data.today.stamps} />
            <Stat label="Eingelöste Prämien heute" value={today.data.today.redemptions} />
            <Stat label="Kunden heute" value={today.data.today.customers} />
          </div>
          {today.data.pendingTaps > 0 || today.data.flagged7d > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {today.data.pendingTaps > 0 ? (
                <Link href="/theke" className="flex items-center gap-4 rounded-2xl border border-line bg-honey-soft p-5 hover:border-honey">
                  <Hourglass className="size-5 text-honey" aria-hidden />
                  <span className="text-sm"><strong>{today.data.pendingTaps}</strong> {today.data.pendingTaps === 1 ? 'Tap wartet' : 'Taps warten'} auf Freigabe</span>
                  <ArrowRight className="ml-auto size-4 text-muted" aria-hidden />
                </Link>
              ) : null}
              {today.data.flagged7d > 0 && can('customers.read') ? (
                <Link href="/buchungen?flagged=true" className="flex items-center gap-4 rounded-2xl border border-line bg-warn-soft p-5 hover:border-warn">
                  <Flag className="size-5 text-warn" aria-hidden />
                  <span className="text-sm"><strong>{today.data.flagged7d}</strong> auffällige {today.data.flagged7d === 1 ? 'Buchung' : 'Buchungen'} in den letzten 7 Tagen</span>
                  <ArrowRight className="ml-auto size-4 text-muted" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}

          <Card className="mt-8">
            <CardHeader title="Letzte Buchungen" action={can('customers.read') ? <Link href="/buchungen" className="text-sm font-medium text-brand hover:underline">Alle ansehen</Link> : undefined} />
            {today.data.recent.length === 0 ? (
              <EmptyState title="Noch keine Buchungen" description="Sobald der erste Stempel vergeben wird, erscheint er hier." />
            ) : (
              <CardBody className="pt-3">
                <ul className="divide-y divide-line">
                  {today.data.recent.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-3 text-sm">
                      <Badge tone={txType[t.type].tone}>{txType[t.type].label}</Badge>
                      {can('customers.read') ? (
                        <Link href={`/kunden/${t.customer.id}`} className="min-w-0 truncate font-medium hover:underline">{fullName(t.customer)}</Link>
                      ) : (
                        <span className="min-w-0 truncate font-medium">{fullName(t.customer)}</span>
                      )}
                      <span className="hidden text-muted sm:inline">· {txSource[t.source]}</span>
                      {t.flagged ? <Flag className="size-3.5 text-warn" aria-label="Auffällig" /> : null}
                      <span className="ml-auto shrink-0 font-semibold tabular">{t.amount > 0 ? '+' : ''}{t.amount}</span>
                      <span className="w-32 shrink-0 whitespace-nowrap text-right text-muted">{formatRelative(t.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            )}
          </Card>
        </>
      )}
    </>
  );
}
