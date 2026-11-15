'use client';
import * as React from 'react';
import Link from 'next/link';
import { Flag, Undo2 } from 'lucide-react';
import type { TransactionDto } from '@tably/types';
import { Badge, Button, cn, defineCopy, formatDateTime, fullName, Table, Td, Th, useCopy } from '@tably/ui';
import { flagReason, txSource, txType } from '@/lib/labels';

const copy = defineCopy({
  de: {
    date: 'Zeitpunkt',
    customer: 'Kunde',
    type: 'Art',
    amount: 'Stempel',
    details: 'Herkunft',
    note: 'Notiz',
    actions: 'Aktionen',
    by: 'von',
    reverse: 'Stornieren',
    reversed: 'Storniert',
    flagged: 'Auffällig',
    flaggedUnknown: 'Zur Kontrolle markiert',
    deleted: 'Gelöschter Kunde',
  },
});

export type TransactionRow = TransactionDto & {
  customer?: { id: string; firstName: string; lastName: string | null };
  programName?: string;
  shortCode?: string;
};

function origin(t: TransactionRow, by: string): string {
  return [txSource[t.source], t.deviceName, t.staffName ? `${by} ${t.staffName}` : null, t.locationName].filter(Boolean).join(' · ');
}

function Amount({ value }: { value: number }) {
  return <span className={cn('font-semibold tabular', value < 0 ? 'text-danger' : 'text-ink')}>{value > 0 ? '+' : ''}{value}</span>;
}

/**
 * Buchungsliste: Tabelle ab Tablet-Breite, Kartenliste auf dem Handy.
 * `onReverse` blendet die Storno-Aktion ein (nur mit Recht stamps.adjust übergeben).
 */
export function TransactionList({ items, showCustomer, showProgram, linkCustomer, onReverse }: { items: TransactionRow[]; showCustomer?: boolean; showProgram?: boolean; linkCustomer?: boolean; onReverse?: (t: TransactionRow) => void }) {
  const t = useCopy(copy);
  const reversedIds = React.useMemo(() => new Set(items.map((i) => i.reversesId).filter((x): x is string => Boolean(x))), [items]);
  const canReverse = (row: TransactionRow) => Boolean(onReverse) && row.type !== 'REVERSAL' && !reversedIds.has(row.id);

  const customerCell = (row: TransactionRow) => {
    if (!row.customer) return null;
    const name = fullName(row.customer);
    return linkCustomer ? (
      <Link href={`/kunden/${row.customer.id}`} className="font-medium text-ink hover:underline">{name}</Link>
    ) : (
      <span className="font-medium">{name}</span>
    );
  };
  const flag = (row: TransactionRow) =>
    row.flagged ? (
      <span className="inline-flex items-start gap-1.5 text-xs font-medium text-warn">
        <Flag className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          <span className="sr-only">{t.flagged}: </span>
          {row.flagReason ? (flagReason[row.flagReason] ?? t.flaggedUnknown) : t.flaggedUnknown}
        </span>
      </span>
    ) : null;
  const action = (row: TransactionRow) =>
    canReverse(row) ? (
      <Button variant="ghost" size="sm" onClick={() => onReverse?.(row)} aria-label={`${t.reverse}: ${txType[row.type].label} ${formatDateTime(row.createdAt)}`}>
        <Undo2 className="size-4" aria-hidden />
        {t.reverse}
      </Button>
    ) : reversedIds.has(row.id) ? (
      <span className="text-xs text-subtle">{t.reversed}</span>
    ) : null;

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>{t.date}</Th>
              {showCustomer ? <Th>{t.customer}</Th> : null}
              <Th>{t.type}</Th>
              <Th className="text-right">{t.amount}</Th>
              <Th>{t.details}</Th>
              {onReverse ? <Th className="text-right"><span className="sr-only">{t.actions}</span></Th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className={cn(reversedIds.has(row.id) && 'opacity-60')}>
                <Td className="whitespace-nowrap text-muted tabular">{formatDateTime(row.createdAt)}</Td>
                {showCustomer ? (
                  <Td>
                    {customerCell(row)}
                    {row.programName ? <span className="block text-xs text-muted">{row.programName}{row.shortCode ? <> · <span className="font-mono">{row.shortCode}</span></> : null}</span> : null}
                  </Td>
                ) : null}
                <Td>
                  <Badge tone={txType[row.type].tone}>{txType[row.type].label}</Badge>
                </Td>
                <Td className="text-right"><Amount value={row.amount} /></Td>
                <Td className="max-w-xs">
                  <span className="block text-muted">{origin(row, t.by)}</span>
                  {!showCustomer && showProgram && row.programName ? <span className="block text-xs text-muted">{row.programName}</span> : null}
                  {row.note ? <span className="block break-words text-xs text-ink">„{row.note}“</span> : null}
                  {flag(row)}
                </Td>
                {onReverse ? <Td className="whitespace-nowrap text-right">{action(row)}</Td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <ul className="divide-y divide-line border-t border-line md:hidden">
        {items.map((row) => (
          <li key={row.id} className={cn('flex flex-col gap-1.5 px-5 py-3.5 text-sm', reversedIds.has(row.id) && 'opacity-60')}>
            <div className="flex items-center gap-2">
              <Badge tone={txType[row.type].tone}>{txType[row.type].label}</Badge>
              <Amount value={row.amount} />
              <span className="ml-auto whitespace-nowrap text-xs text-muted tabular">{formatDateTime(row.createdAt)}</span>
            </div>
            {showCustomer && row.customer ? (
              <p className="min-w-0 truncate">
                {customerCell(row)}
                {row.programName ? <span className="text-muted"> · {row.programName}</span> : null}
              </p>
            ) : null}
            <p className="text-xs text-muted">{origin(row, t.by)}</p>
            {row.note ? <p className="break-words text-xs text-ink">„{row.note}“</p> : null}
            {flag(row)}
            {canReverse(row) || reversedIds.has(row.id) ? <div className="-ml-3">{canReverse(row) ? action(row) : <span className="ml-3 text-xs text-subtle">{t.reversed}</span>}</div> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
