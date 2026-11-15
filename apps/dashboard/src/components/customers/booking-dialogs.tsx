'use client';
import * as React from 'react';
import type { TransactionDto } from '@tably/types';
import { Alert, api, Button, defineCopy, Dialog, Field, formatDateTime, Input, Segmented, Textarea, useCopy, useToast } from '@tably/ui';
import { useSubmit } from '@/lib/use-submit';
import { txType } from '@/lib/labels';
import { useIntentKeys } from '@/components/counter/hooks';

const copy = defineCopy({
  de: {
    cancel: 'Abbrechen',
    // Storno
    reverseTitle: 'Buchung stornieren?',
    reverseText: 'Die Buchung wird durch eine Gegenbuchung ausgeglichen. Beide bleiben in der Historie sichtbar.',
    reverseEffect: (delta: number) => (delta > 0 ? `Der Kartenstand steigt dadurch um ${delta}.` : `Der Kartenstand sinkt dadurch um ${Math.abs(delta)}.`),
    reverseNote: 'Grund',
    reverseNotePlaceholder: 'z. B. versehentlich doppelt gestempelt',
    reverseConfirm: 'Stornieren',
    reverseDone: (balance: number) => `Buchung storniert. Neuer Stand: ${balance}.`,
    // Korrektur
    adjustTitle: 'Stand korrigieren',
    adjustText: (program: string, balance: number) => `${program} · aktueller Stand: ${balance}`,
    direction: 'Art der Korrektur',
    add: 'Hinzufügen',
    remove: 'Abziehen',
    amount: 'Anzahl Stempel',
    amountInvalid: 'Bitte gib eine ganze Zahl ab 1 ein.',
    reason: 'Begründung',
    reasonHint: 'Pflichtfeld – erscheint in der Historie und im Protokoll.',
    reasonInvalid: 'Bitte gib eine kurze Begründung ein (mindestens 3 Zeichen).',
    preview: (balance: number) => `Neuer Stand: ${balance}`,
    negative: 'Der Stand kann nicht unter 0 fallen.',
    adjustConfirm: 'Korrektur buchen',
    adjustDone: (balance: number) => `Stand korrigiert. Neuer Stand: ${balance}.`,
  },
});

type Reversible = Pick<TransactionDto, 'id' | 'type' | 'amount' | 'createdAt'>;

function ReverseBody({ transaction, formId, onDone, onLoading }: { transaction: Reversible; formId: string; onDone: (balance: number) => void; onLoading: (l: boolean) => void }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [note, setNote] = React.useState('');
  const { submit, loading, error, fields } = useSubmit(async () => {
    const res = await api<{ transactionId: string; balance: number }>(`/stamps/${transaction.id}/reverse`, { body: note.trim() ? { note: note.trim() } : {} });
    toast.success(t.reverseDone(res.balance));
    onDone(res.balance);
  });
  React.useEffect(() => onLoading(loading), [loading, onLoading]);
  return (
    <form method="post"
      id={formId}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-ink">
        <span className="font-medium">{txType[transaction.type].label}</span>
        <span className="tabular"> ({transaction.amount > 0 ? '+' : ''}{transaction.amount})</span> vom {formatDateTime(transaction.createdAt)}
        <span className="mt-1 block text-muted">{t.reverseEffect(-transaction.amount)}</span>
      </p>
      <Field label={t.reverseNote} error={fields.note} optional>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t.reverseNotePlaceholder} autoComplete="off" />
      </Field>
    </form>
  );
}

/** Storno einer Buchung mit Bestätigung und optionalem Grund. */
export function ReverseDialog({ transaction, onClose, onDone }: { transaction: Reversible | null; onClose: () => void; onDone: (balance: number) => void }) {
  const t = useCopy(copy);
  const formId = React.useId();
  const [loading, setLoading] = React.useState(false);
  return (
    <Dialog
      open={transaction !== null}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      title={t.reverseTitle}
      description={t.reverseText}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} variant="danger" loading={loading}>
            {t.reverseConfirm}
          </Button>
        </>
      }
    >
      {transaction ? <ReverseBody key={transaction.id} transaction={transaction} formId={formId} onDone={onDone} onLoading={setLoading} /> : null}
    </Dialog>
  );
}

interface AdjustCard {
  id: string;
  balance: number;
  programName: string;
}

function AdjustBody({ card, formId, onDone, onLoading }: { card: AdjustCard; formId: string; onDone: (balance: number) => void; onLoading: (l: boolean) => void }) {
  const t = useCopy(copy);
  const toast = useToast();
  const run = useIntentKeys();
  const [direction, setDirection] = React.useState<'add' | 'remove'>('add');
  const [amount, setAmount] = React.useState('1');
  const [note, setNote] = React.useState('');
  const [local, setLocal] = React.useState<{ amount?: string; note?: string }>({});
  const n = /^\d+$/.test(amount) ? Number(amount) : NaN;
  const delta = direction === 'add' ? n : -n;
  const next = card.balance + delta;

  const { submit, loading, error, fields } = useSubmit(async () => {
    const trimmed = note.trim();
    const res = await run(`adjust:${card.id}:${delta}:${trimmed}`, (idempotencyKey) => api<{ transactionId: string; balance: number; duplicate: boolean }>('/stamps/adjust', { body: { cardId: card.id, delta, note: trimmed }, idempotencyKey }));
    toast.success(t.adjustDone(res.balance));
    onDone(res.balance);
  });
  React.useEffect(() => onLoading(loading), [loading, onLoading]);

  return (
    <form method="post"
      id={formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const errors: { amount?: string; note?: string } = {};
        if (!Number.isInteger(n) || n < 1 || n > 10_000) errors.amount = t.amountInvalid;
        else if (next < 0) errors.amount = t.negative;
        if (note.trim().length < 3) errors.note = t.reasonInvalid;
        setLocal(errors);
        if (!errors.amount && !errors.note) void submit();
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-sm text-muted tabular">{t.adjustText(card.programName, card.balance)}</p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t.direction}</span>
          <Segmented<'add' | 'remove'> label={t.direction} value={direction} onChange={setDirection} options={[{ value: 'add', label: t.add }, { value: 'remove', label: t.remove }]} />
        </div>
        <Field label={t.amount} error={local.amount ?? fields.delta} className="w-36">
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" autoComplete="off" />
        </Field>
      </div>
      {Number.isInteger(n) && n > 0 && next >= 0 ? <p className="text-sm font-medium text-ink tabular" aria-live="polite">{t.preview(next)}</p> : null}
      <Field label={t.reason} error={local.note ?? fields.note} hint={t.reasonHint}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} required className="min-h-20" />
      </Field>
    </form>
  );
}

/** Manuelle Korrektur des Kartenstands (Begründung Pflicht). */
export function AdjustDialog({ card, onClose, onDone }: { card: AdjustCard | null; onClose: () => void; onDone: (balance: number) => void }) {
  const t = useCopy(copy);
  const formId = React.useId();
  const [loading, setLoading] = React.useState(false);
  return (
    <Dialog
      open={card !== null}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      title={t.adjustTitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} loading={loading}>
            {t.adjustConfirm}
          </Button>
        </>
      }
    >
      {card ? <AdjustBody key={card.id} card={card} formId={formId} onDone={onDone} onLoading={setLoading} /> : null}
    </Dialog>
  );
}
