'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check, Gift, Stamp } from 'lucide-react';
import { Alert, api, ApiError, Button, cn, ConfirmDialog, defineCopy, errorMessage, useCopy, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { useIntentKeys } from './hooks';

const copy = defineCopy({
  de: {
    giveStamp: 'Stempel geben',
    stampDone: (name: string, balance: number) => `Stempel für ${name} gebucht. Neuer Stand: ${balance}.`,
    stampDuplicate: 'Dieser Stempel war bereits gebucht – es wurde nichts doppelt vergeben.',
    rewards: 'Prämien',
    noRewards: 'Für diese Karte ist noch keine Prämie hinterlegt.',
    redeem: 'Einlösen',
    cost: (n: number) => `${n} Stempel`,
    missing: (n: number) => `Noch ${n} Stempel bis zur Prämie`,
    confirmTitle: (reward: string) => `„${reward}“ einlösen?`,
    confirmText: (name: string, cost: number, rest: number) => `${cost} Stempel werden von der Karte von ${name} abgezogen. Danach bleiben ${rest}.`,
    confirmAction: 'Jetzt einlösen',
    redeemDone: (reward: string, balance: number) => `„${reward}“ eingelöst. Neuer Stand: ${balance}.`,
    flaggedTitle: 'Gebucht – zur Kontrolle markiert',
    flaggedText: 'Der Stempel ist gutgeschrieben. Weil er ungewöhnlich schnell auf den letzten folgt oder das Tageslimit übersteigt, wurde die Buchung als auffällig markiert.',
    flaggedLink: 'Auffällige Buchungen ansehen',
    restricted: 'Dein Konto ist gerade eingeschränkt – Buchungen sind erst wieder möglich, wenn ein Tarif aktiv ist.',
  },
});

export interface ActionCard {
  cardId: string;
  balance: number;
  customerName: string;
  rewards: Array<{ id: string; name: string; cost: number; available: boolean }>;
}

/**
 * „Stempel geben“ und „Prämie einlösen“ für eine Karte – genutzt an der Theke
 * und im Kundenprofil. Jede Buchung trägt einen Idempotency-Key, der bei einem
 * erneuten Versuch nach Verbindungsfehlern wiederverwendet wird.
 */
export function CardActions({ card, locationId, onChanged, size = 'lg', disabled }: { card: ActionCard; locationId: string | null; onChanged: (balance: number) => void; size?: 'md' | 'lg'; disabled?: boolean }) {
  const t = useCopy(copy);
  const toast = useToast();
  const { can } = useSession();
  const run = useIntentKeys();
  const [stamping, setStamping] = React.useState(false);
  const [redeeming, setRedeeming] = React.useState(false);
  const [confirm, setConfirm] = React.useState<ActionCard['rewards'][number] | null>(null);
  const [status, setStatus] = React.useState<string>('');
  const [failed, setFailed] = React.useState(false);
  const [flagged, setFlagged] = React.useState(false);
  const big = size === 'lg';

  // Beim Wechsel der Karte alte Hinweise entfernen.
  React.useEffect(() => {
    setStatus('');
    setFlagged(false);
    setFailed(false);
  }, [card.cardId]);

  const fail = (err: unknown) => {
    const message = err instanceof ApiError && err.code === 'subscription_restricted' ? t.restricted : errorMessage(err);
    setStatus(message);
    setFailed(true);
    toast.error(message);
  };

  const giveStamp = async () => {
    setStamping(true);
    setFlagged(false);
    setFailed(false);
    try {
      const res = await run(`manual:${card.cardId}`, (idempotencyKey) =>
        api<{ transactionId: string; amount: number; balance: number; duplicate: boolean; flagged: boolean }>('/stamps/manual', { body: { cardId: card.cardId, amount: 1, locationId }, idempotencyKey }),
      );
      const message = res.duplicate ? t.stampDuplicate : t.stampDone(card.customerName, res.balance);
      setStatus(message);
      setFlagged(res.flagged);
      if (res.duplicate) toast.info(message);
      else toast.success(message);
      onChanged(res.balance);
    } catch (err) {
      fail(err);
    } finally {
      setStamping(false);
    }
  };

  const redeem = async () => {
    if (!confirm) return;
    const reward = confirm;
    setRedeeming(true);
    setFlagged(false);
    setFailed(false);
    try {
      const res = await run(`redeem:${card.cardId}:${reward.id}`, (idempotencyKey) =>
        api<{ transactionId: string; balance: number; duplicate: boolean }>('/stamps/redeem', { body: { cardId: card.cardId, rewardId: reward.id, locationId }, idempotencyKey }),
      );
      const message = t.redeemDone(reward.name, res.balance);
      setStatus(message);
      toast.success(message);
      setConfirm(null);
      onChanged(res.balance);
    } catch (err) {
      setConfirm(null);
      fail(err);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button size="lg" className={cn('w-full', big && 'h-14 text-lg')} onClick={() => void giveStamp()} loading={stamping} disabled={disabled}>
        {stamping ? null : <Stamp className="size-5" aria-hidden />}
        {t.giveStamp}
      </Button>

      {flagged ? (
        <Alert tone="warn" title={t.flaggedTitle} action={can('customers.read') ? <Link href="/buchungen?flagged=true" className="text-sm font-semibold underline">{t.flaggedLink}</Link> : undefined}>
          {t.flaggedText}
        </Alert>
      ) : null}

      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-subtle">{t.rewards}</h4>
        {card.rewards.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t.noRewards}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {card.rewards.map((reward) => (
              <li key={reward.id} className={cn('flex items-center gap-3 rounded-xl border p-3', reward.available ? 'border-honey/40 bg-honey-soft' : 'border-line bg-surface')}>
                <Gift className={cn('size-5 shrink-0', reward.available ? 'text-honey' : 'text-subtle')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{reward.name}</p>
                  <p className="text-xs text-muted tabular">{reward.available ? t.cost(reward.cost) : t.missing(reward.cost - card.balance)}</p>
                </div>
                {reward.available ? (
                  <Button variant="honey" size={big ? 'lg' : 'md'} onClick={() => setConfirm(reward)} disabled={disabled} aria-label={`${reward.name}: ${t.redeem}`}>
                    {t.redeem}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p aria-live="polite" className={cn('flex items-start gap-2 text-sm', failed ? 'text-danger' : 'text-muted', !status && 'sr-only')}>
        {status && !failed ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : null}
        {status}
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => (!open && !redeeming ? setConfirm(null) : undefined)}
        title={confirm ? t.confirmTitle(confirm.name) : ''}
        description={confirm ? t.confirmText(card.customerName, confirm.cost, card.balance - confirm.cost) : undefined}
        confirmLabel={t.confirmAction}
        onConfirm={redeem}
        loading={redeeming}
      />
    </div>
  );
}
