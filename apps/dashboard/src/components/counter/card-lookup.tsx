'use client';
import * as React from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { CardLookupDto } from '@tably/types';
import { Alert, api, ApiError, Badge, Button, Card, CardBody, CardHeader, defineCopy, errorMessage, Field, formatRelative, fullName, Input, useCopy } from '@tably/ui';
import { useSession } from '@/lib/session';
import { CardActions } from './card-actions';
import { formatCardCode } from './hooks';
import { StampProgress } from './progress';

const copy = defineCopy({
  de: {
    title: 'Karte suchen',
    description: 'Der Kartencode steht unter der Treuekarte auf dem Handy.',
    label: 'Kartencode',
    placeholder: 'z. B. K7M2-9XQ4',
    hint: 'Groß- und Kleinschreibung und der Bindestrich sind egal.',
    search: 'Suchen',
    tooShort: 'Bitte gib den ganzen Kartencode ein (8 Zeichen).',
    notFound: 'Zu diesem Code gibt es keine Karte. Bitte prüfe die Eingabe.',
    found: (name: string, b: number, r: number) => `Karte von ${name} gefunden. Stand: ${b} von ${r} Stempeln.`,
    balance: 'Stand',
    of: 'von',
    stamps: 'Stempeln',
    lastStamp: 'Letzter Stempel',
    profile: 'Zum Kundenprofil',
    clear: 'Andere Karte',
    customerBlocked: 'Dieses Kundenkonto ist gesperrt. Stempel und Prämien sind nicht möglich.',
    customerDeleted: 'Dieser Kunde wurde gelöscht. Die Karte kann nicht mehr verwendet werden.',
    cardInactive: 'Diese Karte ist nicht aktiv. Stempel und Prämien sind nicht möglich.',
    rewardReady: 'Prämie bereit',
  },
});

export function CardLookup({ locationId }: { locationId: string | null }) {
  const t = useCopy(copy);
  const { can } = useSession();
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [card, setCard] = React.useState<CardLookupDto | null>(null);
  const [announce, setAnnounce] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.replace(/[^A-Z0-9]/g, '');
    if (raw.length < 8) {
      setError(t.tooShort);
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api<CardLookupDto>('/stamps/lookup', { body: { code } });
      setCard(result);
      setAnnounce(t.found(fullName(result.customer), result.balance, result.program.stampsRequired));
    } catch (err) {
      setCard(null);
      setError(err instanceof ApiError && err.code === 'not_found' ? t.notFound : errorMessage(err));
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCard(null);
    setCode('');
    setError(null);
    setAnnounce('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const blockedReason = card ? (card.customer.status === 'ANONYMIZED' ? t.customerDeleted : card.customer.status !== 'ACTIVE' ? t.customerBlocked : card.status !== 'ACTIVE' ? t.cardInactive : null) : null;
  const name = card ? fullName(card.customer) : '';

  return (
    <Card>
      <CardHeader title={t.title} description={t.description} />
      <CardBody>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
          <Field label={t.label} error={error} hint={t.hint} className="flex-1">
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => {
                setCode(formatCardCode(e.target.value));
                if (error) setError(null);
              }}
              placeholder={t.placeholder}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={12}
              className="h-14 font-mono text-xl tracking-widest placeholder:text-base placeholder:tracking-normal"
            />
          </Field>
          <Button type="submit" size="lg" className="h-14 sm:mt-[26px]" loading={loading}>
            {loading ? null : <Search className="size-5" aria-hidden />}
            {t.search}
          </Button>
        </form>
        <p className="sr-only" aria-live="polite">{announce}</p>

        {card ? (
          <div className="mt-6 animate-fade-up rounded-2xl border border-line bg-paper p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-ink">{name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {card.program.name} · <span className="font-mono">{card.shortCode}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="shrink-0">
                <X className="size-4" aria-hidden />
                {t.clear}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm text-muted">
                <span className="mr-2 text-4xl font-semibold tracking-tight text-ink tabular">{card.balance}</span>
                {t.of} {card.program.stampsRequired} {t.stamps}
              </p>
              {card.rewards.some((r) => r.available) ? <Badge tone="honey">{t.rewardReady}</Badge> : null}
            </div>
            <StampProgress balance={card.balance} required={card.program.stampsRequired} className="mt-3" />
            <p className="mt-3 text-xs text-muted">
              {t.lastStamp}: {formatRelative(card.lastStampAt)}
              {can('customers.read') && card.customer.status !== 'ANONYMIZED' ? (
                <>
                  {' · '}
                  <Link href={`/kunden/${card.customer.id}`} className="font-medium text-brand hover:underline">{t.profile}</Link>
                </>
              ) : null}
            </p>

            {blockedReason ? <Alert tone="danger" className="mt-4">{blockedReason}</Alert> : null}

            <div className="mt-5">
              <CardActions
                card={{ cardId: card.cardId, balance: card.balance, customerName: name, rewards: card.rewards }}
                locationId={locationId}
                disabled={blockedReason !== null}
                onChanged={(balance) => setCard((c) => (c ? { ...c, balance, lastStampAt: balance > c.balance ? new Date().toISOString() : c.lastStampAt, rewards: c.rewards.map((r) => ({ ...r, available: balance >= r.cost })) } : c))}
              />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
