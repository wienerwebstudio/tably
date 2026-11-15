import * as React from 'react';
import { Car, Check, Coffee, Croissant, Dumbbell, Flower2, Gift, Heart, Scissors, ShoppingBag, Sparkles, Star, Utensils, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export const STAMP_ICON_MAP: Record<string, LucideIcon> = {
  coffee: Coffee,
  croissant: Croissant,
  utensils: Utensils,
  scissors: Scissors,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  flower: Flower2,
  'shopping-bag': ShoppingBag,
  car: Car,
  star: Star,
  heart: Heart,
  check: Check,
};

export function StampIcon({ name, className }: { name: string; className?: string }) {
  const Icon = STAMP_ICON_MAP[name] ?? Check;
  return <Icon className={className} aria-hidden />;
}

export interface LoyaltyCardData {
  organizationName: string;
  cardTitle: string;
  stampsRequired: number;
  balance: number;
  stampIcon: string;
  rewardName?: string | null;
  unitLabel?: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  logoUrl?: string | null;
  footerText?: string | null;
}

function gridColumns(total: number): number {
  if (total <= 5) return total;
  if (total <= 12) return Math.ceil(total / 2);
  if (total <= 21) return Math.ceil(total / 3);
  return Math.ceil(total / 4);
}

/**
 * Die Treuekarte, wie Kund:innen sie sehen. Wird in der Webkarte, im
 * Karten-Designer und auf der Website verwendet – eine Quelle, ein Aussehen.
 */
export function LoyaltyCard({ data, className, highlightIndex, compact }: { data: LoyaltyCardData; className?: string; /** Index des zuletzt vergebenen Stempels (animiert) */ highlightIndex?: number | null; compact?: boolean }) {
  const total = Math.max(1, Math.min(data.stampsRequired, 30));
  // Bei übervollen Karten (mehr Stempel als Felder) wird die aktuelle Runde gezeigt.
  const shown = data.balance > total ? (data.balance % total === 0 ? total : data.balance % total) : data.balance;
  const rewards = Math.floor(data.balance / total);
  const cols = gridColumns(total);
  const unit = data.unitLabel ?? 'Stempel';
  return (
    <article
      className={cn('relative w-full overflow-hidden rounded-[28px] shadow-pass', compact ? 'p-5' : 'p-6 sm:p-7', className)}
      style={{ background: data.backgroundColor, color: data.textColor }}
      aria-label={`${data.cardTitle} von ${data.organizationName}: ${data.balance} von ${total} ${unit}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full opacity-[0.07]" style={{ background: data.textColor }} aria-hidden />
      <header className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="" className="size-10 shrink-0 rounded-xl bg-white/90 object-contain p-1" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold" style={{ background: data.accentColor, color: data.backgroundColor }} aria-hidden>
              {data.organizationName.trim().charAt(0).toUpperCase() || 'T'}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium opacity-80">{data.organizationName}</p>
            <p className={cn('truncate font-semibold tracking-tight', compact ? 'text-lg' : 'text-xl')}>{data.cardTitle}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium uppercase tracking-widest opacity-70">{unit}</p>
          <p className={cn('font-semibold leading-none tabular', compact ? 'text-xl' : 'text-2xl')}>
            {data.balance}
            <span className="opacity-60"> / {total}</span>
          </p>
        </div>
      </header>

      <div className={cn('relative grid gap-2.5', compact ? 'mt-5' : 'mt-7')} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const filled = i < shown;
          const isLast = i === total - 1;
          return (
            <div
              key={i}
              className={cn('flex aspect-square items-center justify-center rounded-full', filled && highlightIndex === i && 'animate-pop')}
              style={filled ? { background: data.accentColor, color: data.backgroundColor } : { border: `1.5px dashed color-mix(in srgb, ${data.textColor} 40%, transparent)`, color: `color-mix(in srgb, ${data.textColor} 45%, transparent)` }}
            >
              {filled ? <StampIcon name={data.stampIcon} className="size-[46%]" /> : isLast ? <Gift className="size-[42%]" aria-hidden /> : null}
            </div>
          );
        })}
      </div>

      <footer className={cn('relative flex items-center justify-between gap-3 text-sm', compact ? 'mt-5' : 'mt-7')}>
        <p className="min-w-0 truncate opacity-85">
          {rewards > 0 ? (
            <span className="font-semibold" style={{ color: data.accentColor }}>
              {rewards > 1 ? `${rewards}× ` : ''}
              {data.rewardName || 'Prämie'} einlösbar
            </span>
          ) : data.rewardName ? (
            <>
              Noch {total - shown} bis: <span className="font-semibold">{data.rewardName}</span>
            </>
          ) : (
            data.footerText
          )}
        </p>
      </footer>
      {data.footerText && (rewards > 0 || data.rewardName) && !compact ? <p className="relative mt-2 truncate text-xs opacity-60">{data.footerText}</p> : null}
    </article>
  );
}

/** Stilisierter Smartphone-Rahmen für Vorschauen. */
export function PhoneFrame({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[320px] rounded-[44px] border-[10px] border-[#1b1d20] bg-[#1b1d20] shadow-raised', className)} role="img" aria-label={label ?? 'Smartphone-Vorschau'}>
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1b1d20]" aria-hidden />
      <div className="relative overflow-hidden rounded-[34px] bg-paper">{children}</div>
    </div>
  );
}

/** Tably-Wortmarke mit Stempel-Signet. */
export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight text-ink', className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--brand)" />
        <circle cx="16" cy="16" r="7.5" fill="none" stroke="var(--on-brand)" strokeWidth="2" strokeDasharray="3.2 2.4" />
        <circle cx="16" cy="16" r="3.2" fill="var(--honey)" />
      </svg>
      {mark ? null : <span className="text-[1.15em]">Tably</span>}
    </span>
  );
}
