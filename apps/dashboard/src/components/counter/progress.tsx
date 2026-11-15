import * as React from 'react';
import { cn } from '@tably/ui';

/** Fortschritt einer Stempelkarte als Punkte (bis 30) mit Textalternative. */
export function StampProgress({ balance, required, size = 'md', className }: { balance: number; required: number; size?: 'sm' | 'md'; className?: string }) {
  const filled = Math.max(0, Math.min(balance, required));
  const extra = Math.max(0, balance - required);
  return (
    <div role="img" aria-label={`${balance} von ${required} Stempeln`} className={cn('flex flex-wrap items-center', size === 'sm' ? 'gap-1' : 'gap-1.5', className)}>
      {Array.from({ length: required }, (_, i) => (
        <span key={i} className={cn('rounded-full', size === 'sm' ? 'size-2.5' : 'size-4', i < filled ? 'bg-brand' : 'border border-line-strong bg-surface')} />
      ))}
      {extra > 0 ? <span className="ml-1 text-xs font-semibold text-brand tabular">+{extra}</span> : null}
    </div>
  );
}

/** Kompakter Balken für Listen. */
export function StampBar({ balance, required, className }: { balance: number; required: number; className?: string }) {
  const pct = required > 0 ? Math.min(100, Math.round((Math.max(0, balance) / required) * 100)) : 0;
  return (
    <div aria-hidden className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}>
      <div className={cn('h-full rounded-full', balance >= required ? 'bg-honey' : 'bg-brand')} style={{ width: `${pct}%` }} />
    </div>
  );
}
