'use client';
import * as React from 'react';
import { cn } from './cn';

export interface SeriesPoint {
  label: string;
  value: number;
  /** Ausführliche Beschriftung für Tooltip und Screenreader */
  title?: string;
}

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Säulendiagramm ohne Bibliothek. Eine Datentabelle für Screenreader wird
 * immer mitgeliefert; die Grafik selbst ist dekorativ.
 */
export function BarChart({ data, height = 200, unit, className, color = 'var(--brand)' }: { data: SeriesPoint[]; height?: number; unit: string; className?: string; color?: string }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, max / 2, max];
  const every = Math.max(1, Math.ceil(data.length / 8));
  const active = hover !== null ? data[hover] : null;
  return (
    <figure className={cn('relative', className)}>
      <div className="flex gap-3">
        <div className="flex flex-col-reverse justify-between pb-6 text-right text-[11px] text-subtle tabular" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t}>{t.toLocaleString('de-DE')}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }} aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="border-t border-dashed border-line" />
            ))}
          </div>
          <div className="relative flex items-end gap-[3px]" style={{ height: height - 24 }} aria-hidden onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => (
              <div key={i} className="group flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                <div
                  className="w-full rounded-t-[3px] transition-[height,opacity] duration-300"
                  style={{ height: `${max ? (d.value / max) * 100 : 0}%`, minHeight: d.value > 0 ? 2 : 0, background: color, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px] text-[11px] text-subtle" aria-hidden>
            {data.map((d, i) => (
              <span key={i} className="flex-1 overflow-visible whitespace-nowrap text-center">
                {i % every === 0 ? d.label : ''}
              </span>
            ))}
          </div>
          {active ? (
            <div className="pointer-events-none absolute -top-2 right-0 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-raised">
              <span className="font-semibold tabular">{active.value.toLocaleString('de-DE')}</span> {unit} · {active.title ?? active.label}
            </div>
          ) : null}
        </div>
      </div>
      <table className="sr-only">
        <caption>{unit}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.title ?? d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontale Vergleichsbalken (z. B. Standorte, Geräte). */
export function BarList({ items, unit }: { items: Array<{ label: string; value: number; hint?: string }>; unit: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{item.label}</span>
            <span className="shrink-0 text-muted tabular">
              <span className="font-semibold text-ink">{item.value.toLocaleString('de-DE')}</span> {unit}
              {item.hint ? ` · ${item.hint}` : ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
