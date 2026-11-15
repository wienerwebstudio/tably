'use client';
import * as React from 'react';
import { UNLIMITED } from '@tably/config';
import { cn, formatNumber } from '@tably/ui';

export function formatLimit(limit: number): string {
  return limit === UNLIMITED ? 'unbegrenzt' : formatNumber(limit);
}

/** Nutzung gegenüber einem Limit als Balken; -1 bedeutet unbegrenzt. */
export function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === UNLIMITED;
  const ratio = unlimited ? 0 : limit <= 0 ? 1 : Math.min(1, used / limit);
  const full = !unlimited && used >= limit;
  const near = !unlimited && !full && ratio >= 0.8;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className={cn('tabular', full ? 'font-semibold text-danger' : 'text-muted')}>
          {formatNumber(used)} von {formatLimit(limit)}
        </span>
      </div>
      {unlimited ? (
        <div className="mt-2 h-2 rounded-full border border-dashed border-line-strong" aria-hidden />
      ) : (
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={`${used} von ${limit}`}
        >
          <div className={cn('h-full rounded-full', full ? 'bg-danger' : near ? 'bg-honey' : 'bg-brand')} style={{ width: `${Math.max(ratio * 100, used > 0 ? 3 : 0)}%` }} />
        </div>
      )}
    </div>
  );
}

/** Abschnitt innerhalb eines Reiters mit einheitlichem Abstand. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>;
}
