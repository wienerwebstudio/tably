'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Check, ChevronRight, Gift, Megaphone, Settings2, Smartphone } from 'lucide-react';
import type { CardViewDto } from '@tably/types';
import { Alert, api, ApiError, Badge, Button, cn, ConfirmDialog, defineCopy, Dialog, EmptyState, ErrorState, Field, formatDate, formatRelative, Input, Skeleton, Switch, useCopy, useToast } from '@tably/ui';
import { ProgramCard } from '@/components/card/program-card';

const copy = defineCopy({
  de: {
    welcomeTitle: 'Deine Karte ist bereit',
    welcomeText: 'Halte beim nächsten Besuch den Stempel an dein Handy. Tipp: Speichere diese Seite auf deinem Home-Bildschirm.',
    notFoundTitle: 'Karte nicht gefunden',
    notFoundText: 'Diese Karte ist auf diesem Gerät nicht geöffnet. Öffne sie über „Meine Karten“ oder den Link in deiner Wallet-Karte.',
    myCards: 'Meine Karten',
    blocked: 'Diese Karte ist derzeit gesperrt. Bitte sprich das Team im Geschäft an.',
    paused: 'Dieses Treueprogramm ist im Moment pausiert. Dein Stand bleibt erhalten.',
    rewards: 'Prämien',
    redeem: 'Einlösen',
    missing: (n: number, unit: string) => `Noch ${n} ${unit}`,
    codeTitle: 'Zeig diesen Code an der Theke',
    codeText: (reward: string) => `Für: ${reward}. Der Stempelstand ändert sich erst, wenn das Team den Code bestätigt.`,
    codeValid: (s: string) => `Gültig noch ${s}`,
    codeExpired: 'Der Code ist abgelaufen.',
    codeCancel: 'Abbrechen',
    codeNew: 'Neuen Code erzeugen',
    redeemed: 'Eingelöst – lass es dir schmecken!',
    pendingUnknown: 'Für diese Karte läuft bereits eine Einlösung. Erzeuge einen neuen Code, um sie zu ersetzen.',
    offers: 'Aktuell',
    until: (d: string) => `Bis ${d}`,
    history: 'Letzte Aktivität',
    historyEmpty: 'Noch keine Stempel – der erste wartet beim nächsten Besuch.',
    historyTypes: { EARN: 'Stempel', REDEEM: 'Prämie eingelöst', ADJUST: 'Korrektur', REVERSAL: 'Storno' } as Record<string, string>,
    code: 'Kartencode',
    codeHint: 'Falls der Stempel einmal nicht greifbar ist, kann das Team deine Karte über diesen Code finden.',
    walletTitle: 'In deiner Wallet speichern',
    apple: 'Zu Apple Wallet hinzufügen',
    google: 'Zu Google Wallet hinzufügen',
    walletError: 'Die Wallet-Karte konnte nicht erstellt werden.',
    settings: 'Meine Daten',
    firstName: 'Vorname',
    email: 'E-Mail-Adresse',
    emailHint: 'Zum Wiederfinden deiner Karte auf einem neuen Gerät.',
    birthday: 'Geburtstag',
    marketing: 'Angebote und Neuigkeiten',
    marketingHint: 'Du kannst deine Einwilligung jederzeit hier widerrufen.',
    save: 'Speichern',
    saved: 'Gespeichert',
    exportData: 'Meine Daten herunterladen',
    deleteData: 'Karte und Daten löschen',
    deleteTitle: 'Wirklich alles löschen?',
    deleteText: 'Deine Karte, dein Stempelstand und deine Angaben werden unwiderruflich gelöscht.',
    deleteConfirm: 'Endgültig löschen',
    deleted: 'Deine Daten wurden gelöscht.',
    validUntil: (d: string) => `Karte gültig bis ${d}`,
    terms: 'Bedingungen',
  },
});

function useCountdown(until: string | null): number {
  const [left, setLeft] = React.useState(() => (until ? Math.max(0, new Date(until).getTime() - Date.now()) : 0));
  React.useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, new Date(until).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return left;
}

interface ActiveCode {
  redemptionId: string;
  code: string;
  expiresAt: string;
  rewardName: string;
}

function RedemptionCode({ active, onCancel, onRenew }: { active: ActiveCode; onCancel: () => void; onRenew: () => void }) {
  const t = useCopy(copy);
  const left = useCountdown(active.expiresAt);
  const expired = left <= 0;
  const mm = Math.floor(left / 60_000);
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0');
  return (
    <section className="rounded-3xl border border-honey/40 bg-honey-soft p-6 text-center" aria-live="polite">
      <h2 className="text-base font-semibold">{t.codeTitle}</h2>
      <p className={cn('my-4 font-mono text-5xl font-semibold tracking-[0.18em] tabular', expired && 'opacity-30')} aria-label={`Code ${active.code.split('').join(' ')}`}>
        {active.code.slice(0, 3)}&thinsp;{active.code.slice(3)}
      </p>
      <p className="text-sm text-muted">{expired ? t.codeExpired : t.codeText(active.rewardName)}</p>
      {!expired ? <p className="mt-2 text-sm font-medium text-honey tabular">{t.codeValid(`${mm}:${ss}`)}</p> : null}
      <div className="mt-5 flex justify-center gap-2">
        {expired ? <Button onClick={onRenew}>{t.codeNew}</Button> : null}
        <Button variant="outline" onClick={onCancel}>{t.codeCancel}</Button>
      </div>
    </section>
  );
}

function SettingsDialog({ card, open, onOpenChange, onChanged }: { card: CardViewDto; open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void }) {
  const t = useCopy(copy);
  const toast = useToast();
  const router = useRouter();
  const [marketing, setMarketing] = React.useState(card.marketingConsent);
  const [saving, setSaving] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  React.useEffect(() => setMarketing(card.marketingConsent), [card.marketingConsent, open]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSaving(true);
    setFields({});
    try {
      await api(`/public/cards/${card.id}/profile`, { method: 'PATCH', body: { firstName: data.get('firstName'), email: data.get('email') || null, birthday: data.get('birthday') || null, marketingConsent: marketing } });
      toast.success(t.saved);
      onChanged();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        if (Object.keys(err.fields).length === 0) toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    try {
      const data = await api<unknown>(`/public/cards/${card.id}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meine-treuekarte.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.walletError);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} title={t.settings}>
        <form method="post" id="card-settings" onSubmit={save} className="flex flex-col gap-4" noValidate>
          <Field label={t.firstName} error={fields.firstName}>
            <Input name="firstName" defaultValue={card.customer.firstName} autoComplete="given-name" required className="h-11 text-base" />
          </Field>
          <Field label={t.email} optional hint={t.emailHint} error={fields.email}>
            <Input name="email" type="email" defaultValue={card.customer.email ?? ''} autoComplete="email" className="h-11 text-base" />
          </Field>
          <Field label={t.birthday} optional error={fields.birthday}>
            <Input name="birthday" type="date" defaultValue={card.customer.birthday?.slice(0, 10) ?? ''} className="h-11 text-base" />
          </Field>
          <Switch checked={marketing} onCheckedChange={setMarketing} label={t.marketing} description={t.marketingHint} />
          <Button type="submit" loading={saving} size="lg">{t.save}</Button>
        </form>
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
          <Button variant="outline" onClick={() => void exportData()}>{t.exportData}</Button>
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>{t.deleteData}</Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.deleteTitle}
        description={t.deleteText}
        confirmLabel={t.deleteConfirm}
        danger
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await api(`/public/cards/${card.id}`, { method: 'DELETE' });
            toast.success(t.deleted);
            router.replace('/karten');
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : t.walletError);
            setDeleting(false);
          }
        }}
      />
    </>
  );
}

function CardView() {
  const t = useCopy(copy);
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const toast = useToast();
  const [active, setActive] = React.useState<ActiveCode | null>(null);
  const [redeemedNotice, setRedeemedNotice] = React.useState(false);
  const [redeeming, setRedeeming] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [walletLoading, setWalletLoading] = React.useState(false);
  const storageKey = `tably-code-${id}`;

  // Solange ein Code angezeigt wird, schneller aktualisieren – so erscheint die Bestätigung sofort.
  const { data: card, error, isLoading, mutate } = useSWR<CardViewDto, ApiError>(`/public/cards/${id}`, { refreshInterval: active ? 2500 : 15_000, revalidateOnFocus: true });

  // Code nach einem Neuladen der Seite wiederherstellen (er existiert serverseitig nur als Hash).
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setActive(JSON.parse(raw) as ActiveCode);
    } catch {
      /* kein Speicher verfügbar */
    }
  }, [storageKey]);

  const clearCode = React.useCallback(() => {
    setActive(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignorieren */
    }
  }, [storageKey]);

  // Wurde die offene Einlösung serverseitig abgeschlossen oder verworfen?
  React.useEffect(() => {
    if (!card || !active) return;
    if (card.pendingRedemption?.id === active.redemptionId) return;
    const completed = card.history.some((h) => h.type === 'REDEEM' && new Date(h.createdAt).getTime() > new Date(active.expiresAt).getTime() - 5 * 60_000 - 5_000);
    if (new Date(active.expiresAt).getTime() > Date.now() && completed) {
      setRedeemedNotice(true);
      if ('vibrate' in navigator) navigator.vibrate?.(70);
      clearCode();
    } else if (!card.pendingRedemption && new Date(active.expiresAt).getTime() > Date.now()) {
      clearCode();
    }
  }, [card, active, clearCode]);

  const requestCode = React.useCallback(
    async (rewardId: string) => {
      setRedeeming(rewardId);
      setRedeemedNotice(false);
      try {
        const res = await api<ActiveCode>(`/public/cards/${id}/redemptions`, { body: { rewardId } });
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(res));
        } catch {
          /* ignorieren */
        }
        // Erst die Karte neu laden: sonst hielte der Abgleich unten den frischen Code für erledigt.
        await mutate();
        setActive(res);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t.walletError);
      } finally {
        setRedeeming(null);
      }
    },
    [id, mutate, storageKey, t, toast],
  );

  async function cancelCode() {
    clearCode();
    await api(`/public/cards/${id}/redemptions`, { method: 'DELETE' }).catch(() => undefined);
    void mutate();
  }

  async function addToGoogle() {
    setWalletLoading(true);
    try {
      const res = await api<{ url: string }>(`/public/cards/${id}/wallet/google`);
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.walletError);
      setWalletLoading(false);
    }
  }

  if (error?.status === 404) {
    return <EmptyState className="flex-1" title={t.notFoundTitle} description={t.notFoundText} action={<Link href="/karten" className="font-medium text-brand underline">{t.myCards}</Link>} />;
  }
  if (error && !card) return <ErrorState onRetry={() => void mutate()} />;
  if (isLoading || !card) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64 rounded-[28px]" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const usable = card.status === 'ACTIVE' && card.customer.status === 'ACTIVE';
  const firstAvailable = card.rewards.find((r) => r.available);
  const unit = card.program.unitLabel;

  return (
    <div className="flex flex-col gap-6">
      {params.get('neu') === '1' ? <Alert tone="success" title={t.welcomeTitle}>{t.welcomeText}</Alert> : null}
      {redeemedNotice ? <Alert tone="success" title={t.redeemed} /> : null}
      {!usable ? <Alert tone="danger">{t.blocked}</Alert> : card.program.status !== 'PUBLISHED' ? <Alert tone="warn">{t.paused}</Alert> : null}

      {active ? (
        <RedemptionCode active={active} onCancel={() => void cancelCode()} onRenew={() => (firstAvailable ? void requestCode(firstAvailable.id) : void cancelCode())} />
      ) : card.pendingRedemption ? (
        <Alert tone="info">{t.pendingUnknown}</Alert>
      ) : null}

      <ProgramCard program={card.program} balance={card.balance} />

      {card.rewards.length > 0 ? (
        <section aria-labelledby="rewards-title">
          <h2 id="rewards-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">{t.rewards}</h2>
          <ul className="flex flex-col gap-2.5">
            {card.rewards.map((reward) => (
              <li key={reward.id} className={cn('flex items-center gap-4 rounded-2xl border bg-surface p-4', reward.available ? 'border-honey/50' : 'border-line')}>
                <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', reward.available ? 'bg-honey text-white' : 'bg-sunken text-muted')} aria-hidden>
                  <Gift className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{reward.name}</p>
                  <p className="text-sm text-muted">
                    {reward.cost} {unit}
                    {reward.description ? ` · ${reward.description}` : ''}
                  </p>
                </div>
                {reward.available && usable ? (
                  <Button variant="honey" loading={redeeming === reward.id} onClick={() => void requestCode(reward.id)}>{t.redeem}</Button>
                ) : (
                  <span className="shrink-0 text-sm text-muted tabular">{t.missing(reward.missing, unit)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {card.offers.length > 0 ? (
        <section aria-labelledby="offers-title">
          <h2 id="offers-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">{t.offers}</h2>
          <ul className="flex flex-col gap-2.5">
            {card.offers.map((offer) => (
              <li key={offer.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden><Megaphone className="size-5" /></span>
                <div className="min-w-0">
                  <p className="font-medium">{offer.subject}</p>
                  {offer.body ? <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{offer.body.replace(/\{\{\s*vorname\s*\}\}/gi, card.customer.firstName)}</p> : null}
                  {offer.endsAt ? <p className="mt-1 text-xs text-subtle">{t.until(formatDate(offer.endsAt))}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {card.wallet.apple || card.wallet.google ? (
        <section aria-labelledby="wallet-title" className="rounded-2xl border border-line bg-surface p-4">
          <h2 id="wallet-title" className="mb-3 flex items-center gap-2 text-sm font-semibold"><Smartphone className="size-4" aria-hidden /> {t.walletTitle}</h2>
          <div className="flex flex-col gap-2">
            {card.wallet.apple ? <a href={`/api/public/cards/${card.id}/wallet/apple`} className="flex h-12 items-center justify-center rounded-xl bg-black text-sm font-medium text-white">{t.apple}</a> : null}
            {card.wallet.google ? <Button variant="outline" size="lg" loading={walletLoading} onClick={() => void addToGoogle()}>{t.google}</Button> : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">{t.history}</h2>
        {card.history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-muted">{t.historyEmpty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            {card.history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3 text-sm">
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', h.amount > 0 ? 'bg-success-soft text-success' : 'bg-honey-soft text-honey')} aria-hidden>
                  {h.amount > 0 ? <Check className="size-3.5" /> : <Gift className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.historyTypes[h.type] ?? h.type}{h.type === 'REDEEM' && h.note ? `: ${h.note}` : ''}</span>
                <span className="font-semibold tabular">{h.amount > 0 ? '+' : ''}{h.amount}</span>
                <span className="w-28 shrink-0 text-right text-muted">{formatRelative(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t.code}</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tracking-wider">{card.shortCode}</p>
          </div>
          {card.expiresAt ? <Badge>{t.validUntil(formatDate(card.expiresAt))}</Badge> : null}
        </div>
        <p className="mt-2 text-sm text-muted">{t.codeHint}</p>
      </section>

      <button type="button" onClick={() => setSettingsOpen(true)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:bg-sunken">
        <Settings2 className="size-5 text-muted" aria-hidden />
        <span className="flex-1 font-medium">{t.settings}</span>
        <ChevronRight className="size-4 text-subtle" aria-hidden />
      </button>

      {card.program.terms ? (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-medium text-ink">{t.terms}</summary>
          <p className="mt-2 whitespace-pre-line">{card.program.terms}</p>
        </details>
      ) : null}

      <SettingsDialog card={card} open={settingsOpen} onOpenChange={setSettingsOpen} onChanged={() => void mutate()} />
    </div>
  );
}

export default function CardPage() {
  return (
    <React.Suspense>
      <CardView />
    </React.Suspense>
  );
}
