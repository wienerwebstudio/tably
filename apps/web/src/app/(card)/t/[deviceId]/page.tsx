'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Check, Clock, Hourglass, Nfc, XCircle } from 'lucide-react';
import type { CardViewDto, TapResultDto } from '@tably/types';
import { api, ApiError, Badge, buttonClass, cn, defineCopy, Spinner, useCopy } from '@tably/ui';
import { EnrollForm } from '@/components/card/enroll-form';
import { ProgramCard } from '@/components/card/program-card';

const copy = defineCopy({
  de: {
    verifying: 'Stempel wird geprüft …',
    simulated: 'Simulation',
    successTitle: (n: number) => (n === 1 ? 'Stempel erhalten!' : `${n} Stempel erhalten!`),
    remaining: (n: number) => `Noch ${n} bis zu deiner Prämie.`,
    rewardReady: 'Deine Prämie ist einlösbar!',
    redeemNow: 'Prämie einlösen',
    viewCard: 'Karte ansehen',
    pendingTitle: 'Fast geschafft',
    pendingApproval: 'Das Team bestätigt deinen Stempel gleich an der Theke.',
    pendingPos: 'Dein Stempel wird gutgeschrieben, sobald dein Einkauf an der Kasse erfasst ist.',
    rejectedTitle: 'Kein Stempel',
    expiredTitle: 'Zeit abgelaufen',
    expiredText: 'Bitte halte den Stempel noch einmal an dein Handy.',
    activatedTitle: 'Stempel aktiviert',
    activatedText: 'Dieser NFC-Stempel ist jetzt einsatzbereit. Ab dem nächsten Tap werden Stempel vergeben.',
    enrollTitle: 'Noch ein Schritt',
    enrollText: 'Leg kurz deine Karte an – dein Stempel wartet schon.',
    errorTitle: 'Das hat nicht geklappt',
    incomplete: 'Der Link ist unvollständig. Bitte halte den Stempel noch einmal an dein Handy.',
    hints: {
      tap_replayed: 'Jeder Tap gilt nur einmal. Halte den Stempel einfach noch einmal an dein Handy.',
      tap_invalid: 'Bitte halte den Stempel noch einmal an dein Handy.',
      device_inactive: 'Sag bitte kurz dem Team Bescheid.',
      device_unassigned: 'Sag bitte kurz dem Team Bescheid.',
      rate_limited: 'Bitte warte einen Moment.',
    } as Record<string, string>,
    myCards: 'Meine Karten',
  },
});

type State = { kind: 'verifying' } | { kind: 'result'; result: TapResultDto } | { kind: 'error'; code: string; message: string };

// Verhindert doppeltes Einreichen derselben URL (z. B. durch doppelte Effekte in der Entwicklung).
const inflight = new Map<string, Promise<TapResultDto>>();
function submitTap(deviceId: string, e: string, c: string): Promise<TapResultDto> {
  const key = `${deviceId}:${e}:${c}`;
  let promise = inflight.get(key);
  if (!promise) {
    promise = api<TapResultDto>('/public/taps', { body: { deviceId, e, c } });
    inflight.set(key, promise);
  }
  return promise;
}

function StatusIcon({ tone, children }: { tone: 'success' | 'wait' | 'error' | 'info'; children: React.ReactNode }) {
  const tones = { success: 'bg-success text-white', wait: 'bg-honey-soft text-honey', error: 'bg-danger-soft text-danger', info: 'bg-brand-soft text-brand' };
  return <div className={cn('mx-auto flex size-20 items-center justify-center rounded-full [&>svg]:size-9', tones[tone], tone === 'success' && 'animate-pop')}>{children}</div>;
}

function TapView() {
  const t = useCopy(copy);
  const { deviceId } = useParams<{ deviceId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const e = params.get('e');
  const c = params.get('c');
  const [state, setState] = React.useState<State>({ kind: 'verifying' });

  React.useEffect(() => {
    if (!e || !c) {
      setState({ kind: 'error', code: 'incomplete', message: t.incomplete });
      return;
    }
    let active = true;
    submitTap(deviceId, e, c)
      .then((result) => active && setState({ kind: 'result', result }))
      .catch((err) => active && setState({ kind: 'error', code: err instanceof ApiError ? err.code : 'internal_error', message: err instanceof ApiError ? err.message : t.errorTitle }));
    return () => {
      active = false;
    };
  }, [deviceId, e, c, t]);

  const result = state.kind === 'result' ? state.result : null;
  const pending = result?.status === 'pending_approval' || result?.status === 'pending_pos';

  // Wartende Taps regelmäßig abfragen, bis das Team bzw. die Kasse entschieden hat.
  useSWR<TapResultDto>(pending && result?.tapToken ? `/public/taps/${result.tapToken}` : null, {
    refreshInterval: 1500,
    onSuccess: (next) => {
      if (next.status !== result?.status) setState({ kind: 'result', result: { ...next, tapToken: result?.tapToken } });
    },
  });

  const completed = result?.status === 'completed';
  React.useEffect(() => {
    if (completed && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(70);
  }, [completed]);

  const cardId = result?.card?.id;
  const card = useSWR<CardViewDto>(cardId ? `/public/cards/${cardId}` : null);

  const simulatedBadge = result?.simulated ? <Badge tone="warn" className="mx-auto">{t.simulated}</Badge> : null;
  const cardVisual =
    card.data && result?.card ? (
      <ProgramCard program={card.data.program} balance={result.card.balance} highlightIndex={completed ? Math.min(result.card.balance, result.card.stampsRequired) - 1 : null} compact />
    ) : cardId ? (
      <div className="h-56 rounded-[28px] bg-sunken" aria-hidden />
    ) : null;

  if (state.kind === 'verifying') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" role="status" aria-live="polite">
        <StatusIcon tone="info"><Nfc /></StatusIcon>
        <p className="flex items-center gap-3 text-lg font-medium"><Spinner /> {t.verifying}</p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" role="alert">
        <StatusIcon tone="error"><XCircle /></StatusIcon>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.errorTitle}</h1>
          <p className="mt-2 text-muted">{state.message}</p>
          {t.hints[state.code] ? <p className="mt-1 text-muted">{t.hints[state.code]}</p> : null}
        </div>
        <Link href="/karten" className={buttonClass({ variant: 'outline', size: 'lg' })}>{t.myCards}</Link>
      </div>
    );
  }

  const r = state.result;

  if (r.status === 'needs_enrollment' && r.program) {
    return (
      <div className="flex flex-col gap-6">
        {simulatedBadge}
        <ProgramCard program={r.program} balance={r.program.signupBonus} compact />
        <div>
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">{t.enrollTitle}</h1>
          <p className="mt-2 text-muted">{t.enrollText}</p>
        </div>
        <EnrollForm
          program={r.program}
          tapToken={r.tapToken}
          onDone={(done) => {
            if (done.tap) setState({ kind: 'result', result: done.tap });
            else router.replace(`/karte/${done.cardId}?neu=1`);
          }}
        />
      </div>
    );
  }

  if (r.status === 'device_activated') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" role="status">
        <StatusIcon tone="success"><Check strokeWidth={3} /></StatusIcon>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.activatedTitle}</h1>
          <p className="mt-2 text-muted">{t.activatedText}</p>
        </div>
      </div>
    );
  }

  const remaining = r.card ? Math.max(0, r.card.stampsRequired - r.card.balance) : 0;

  return (
    <div className="flex flex-1 flex-col gap-7 pt-4" aria-live="polite">
      {simulatedBadge}
      {r.status === 'completed' ? (
        <div className="text-center" role="status">
          <StatusIcon tone="success"><Check strokeWidth={3} /></StatusIcon>
          <h1 className="mt-5 font-display text-3xl tracking-tight">{t.successTitle(r.amount ?? 1)}</h1>
          <p className="mt-2 text-lg text-muted">{r.card?.rewardReady ? t.rewardReady : r.card ? t.remaining(remaining) : null}</p>
        </div>
      ) : r.status === 'rejected' ? (
        <div className="text-center" role="alert">
          <StatusIcon tone="error"><Clock /></StatusIcon>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t.rejectedTitle}</h1>
          <p className="mt-2 text-muted">{r.message}</p>
        </div>
      ) : r.status === 'expired' ? (
        <div className="text-center" role="alert">
          <StatusIcon tone="error"><Clock /></StatusIcon>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t.expiredTitle}</h1>
          <p className="mt-2 text-muted">{t.expiredText}</p>
        </div>
      ) : (
        <div className="text-center" role="status">
          <StatusIcon tone="wait"><Hourglass className="animate-pulse" /></StatusIcon>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t.pendingTitle}</h1>
          <p className="mt-2 text-muted">{r.status === 'pending_pos' ? t.pendingPos : t.pendingApproval}</p>
        </div>
      )}
      {cardVisual}
      {cardId ? (
        <div className="mt-auto flex flex-col gap-3">
          {r.card?.rewardReady && r.status === 'completed' ? (
            <Link href={`/karte/${cardId}?einloesen=1`} className={buttonClass({ variant: 'honey', size: 'lg', className: 'h-14 text-base' })}>{t.redeemNow}</Link>
          ) : null}
          <Link href={`/karte/${cardId}`} className={buttonClass({ variant: r.card?.rewardReady && r.status === 'completed' ? 'outline' : 'primary', size: 'lg', className: 'h-14 text-base' })}>{t.viewCard}</Link>
        </div>
      ) : null}
    </div>
  );
}

export default function TapPage() {
  return (
    <React.Suspense>
      <TapView />
    </React.Suspense>
  );
}
