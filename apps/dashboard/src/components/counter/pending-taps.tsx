'use client';
import * as React from 'react';
import useSWR from 'swr';
import { Check, Coffee, Hourglass, X } from 'lucide-react';
import type { PendingTapDto, TapResultDto } from '@tapperl/types';
import { api, Badge, Button, Card, CardHeader, cn, defineCopy, EmptyState, ErrorState, errorMessage, formatRelative, Skeleton, useCopy, useToast } from '@tapperl/ui';
import { useNow } from './hooks';
import { StampProgress } from './progress';

const copy = defineCopy({
  de: {
    title: 'Wartende Taps',
    description: 'Kund:innen, die gerade ihr Handy an den Stempel gehalten haben.',
    emptyTitle: 'Alles erledigt',
    emptyText: 'Gerade wartet niemand auf eine Freigabe. Neue Taps erscheinen hier automatisch.',
    errorText: 'Die wartenden Taps konnten nicht geladen werden.',
    approve: 'Freigeben',
    reject: 'Ablehnen',
    unknownCustomer: 'Unbekannte Karte',
    waitingPos: 'Wartet auf Kasse',
    simulated: 'Simulation',
    balance: (b: number, r: number) => `${b} von ${r} Stempeln`,
    lastStamp: 'Letzter Stempel',
    remaining: 'Noch',
    expired: 'Abgelaufen',
    approved: (name: string) => `Stempel für ${name} gutgeschrieben.`,
    rejected: (name: string) => `Tap von ${name} abgelehnt.`,
    notBooked: 'Der Stempel wurde nicht gutgeschrieben.',
    count: (n: number) => (n === 0 ? 'Keine wartenden Taps.' : n === 1 ? 'Ein Tap wartet auf Freigabe.' : `${n} Taps warten auf Freigabe.`),
    live: 'Aktualisiert sich automatisch',
  },
});

function remainingText(expiresAt: string, now: number): string | null {
  const seconds = Math.floor((new Date(expiresAt).getTime() - now) / 1000);
  if (seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')} Min.`;
}

function TapRow({ tap, now, onDecided }: { tap: PendingTapDto; now: number; onDecided: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [busy, setBusy] = React.useState<'APPROVE' | 'REJECT' | null>(null);
  const name = tap.customerName ?? t.unknownCustomer;
  const remaining = remainingText(tap.expiresAt, now);

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    setBusy(decision);
    try {
      const result = await api<TapResultDto>(`/taps/${tap.id}/decision`, { body: { decision } });
      if (decision === 'REJECT') toast.info(t.rejected(name));
      else if (result.status === 'completed') toast.success(t.approved(name));
      else toast.error(result.message ?? t.notBooked);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      await onDecided().catch(() => undefined);
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-col gap-4 px-5 py-4 @2xl:flex-row @2xl:items-center sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-lg font-semibold text-ink">{name}</p>
          {tap.status === 'PENDING_POS' ? <Badge tone="info">{t.waitingPos}</Badge> : null}
          {tap.simulated ? <Badge tone="warn">{t.simulated}</Badge> : null}
        </div>
        {tap.card ? (
          <>
            <p className="mt-0.5 text-sm text-muted">
              {tap.card.programName} · <span className="font-mono">{tap.card.shortCode}</span> · <span className="tabular">{t.balance(tap.card.balance, tap.card.stampsRequired)}</span>
            </p>
            <StampProgress balance={tap.card.balance} required={tap.card.stampsRequired} size="sm" className="mt-2" />
          </>
        ) : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{[tap.deviceName, tap.locationName].filter(Boolean).join(' · ')}</span>
          {tap.card ? <span>{t.lastStamp}: {formatRelative(tap.card.lastStampAt, new Date(now))}</span> : null}
          <span className={cn('inline-flex items-center gap-1 font-medium tabular', remaining ? 'text-ink' : 'text-danger')}>
            <Hourglass className="size-3.5" aria-hidden />
            {remaining ? `${t.remaining} ${remaining}` : t.expired}
          </span>
        </p>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 @2xl:w-80">
        <Button variant="outline" size="lg" className="h-14" onClick={() => void decide('REJECT')} loading={busy === 'REJECT'} disabled={busy !== null} aria-label={`${t.reject}: ${name}`}>
          {busy === 'REJECT' ? null : <X className="size-5" aria-hidden />}
          {t.reject}
        </Button>
        <Button size="lg" className="h-14" onClick={() => void decide('APPROVE')} loading={busy === 'APPROVE'} disabled={busy !== null || !remaining} aria-label={`${t.approve}: ${name}`}>
          {busy === 'APPROVE' ? null : <Check className="size-5" aria-hidden />}
          {t.approve}
        </Button>
      </div>
    </li>
  );
}

export function PendingTaps() {
  const t = useCopy(copy);
  const { data, error, mutate } = useSWR<PendingTapDto[]>('/taps/pending', { refreshInterval: 3000, dedupingInterval: 1000 });
  const now = useNow(1000);

  return (
    <Card className="@container">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {t.title}
            {data && data.length > 0 ? <Badge tone="honey">{data.length}</Badge> : null}
          </span>
        }
        description={t.description}
        action={
          <span className="hidden items-center gap-1.5 text-xs text-subtle @lg:inline-flex">
            <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
            {t.live}
          </span>
        }
      />
      <p className="sr-only" aria-live="polite">{data ? t.count(data.length) : ''}</p>
      {error && !data ? (
        <ErrorState description={t.errorText} onRetry={() => void mutate()} />
      ) : !data ? (
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={<Coffee />} title={t.emptyTitle} description={t.emptyText} className="py-10" />
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {data.map((tap) => (
            <TapRow key={tap.id} tap={tap} now={now} onDecided={() => mutate()} />
          ))}
        </ul>
      )}
    </Card>
  );
}
