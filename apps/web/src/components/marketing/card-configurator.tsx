'use client';
import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn, Input, LoyaltyCard, StampIcon } from '@tably/ui';
import { INDUSTRIES } from './site';

const PALETTES = [
  { name: 'Papier & Wald', backgroundColor: '#F6F1E7', textColor: '#1F3A2E', accentColor: '#C98A2B' },
  { name: 'Waldgrün', backgroundColor: '#1F3A2E', textColor: '#F4F1E8', accentColor: '#E8B86D' },
  { name: 'Nachtblau', backgroundColor: '#16223B', textColor: '#F4F1EA', accentColor: '#F2A93B' },
  { name: 'Ziegelrot', backgroundColor: '#7A2E22', textColor: '#FBEFE6', accentColor: '#F2C580' },
  { name: 'Rosé', backgroundColor: '#FBEAF0', textColor: '#6A1E3E', accentColor: '#D4487A' },
  { name: 'Graphit', backgroundColor: '#1E1F24', textColor: '#F2EEE8', accentColor: '#B7EE72' },
] as const;
const COUNTS = [5, 6, 8, 10, 12] as const;

function Group({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        {label}
        {hint ? <span className="tabular text-xs font-normal text-muted">{hint}</span> : null}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

/** Interaktive Kartenvorschau: Branche, Farbe und Stempelzahl ändern die Karte live. */
export function CardConfigurator() {
  const reduce = useReducedMotion();
  const [industryId, setIndustryId] = React.useState(INDUSTRIES[0]!.id);
  const [palette, setPalette] = React.useState<number | null>(null);
  const [count, setCount] = React.useState<number | null>(null);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [name, setName] = React.useState('');
  const nameId = React.useId();
  const rangeId = React.useId();

  const industry = INDUSTRIES.find((i) => i.id === industryId) ?? INDUSTRIES[0]!;
  const total = count ?? industry.card.stampsRequired;
  const current = Math.min(balance ?? industry.card.balance, total);
  const colors = palette === null ? industry.card : PALETTES[palette]!;
  const data = {
    ...industry.card,
    organizationName: name.trim() || industry.card.organizationName,
    stampsRequired: total,
    balance: current,
    backgroundColor: colors.backgroundColor,
    textColor: colors.textColor,
    accentColor: colors.accentColor,
  };

  function pickIndustry(id: string) {
    setIndustryId(id);
    setPalette(null);
    setCount(null);
    setBalance(null);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <div className="order-2 space-y-8 lg:order-1">
        <Group label="Branche">
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => {
              const active = i.id === industryId;
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickIndustry(i.id)}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                    active ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-surface text-ink hover:border-subtle hover:bg-sunken',
                  )}
                >
                  <StampIcon name={i.card.stampIcon} className="size-4" />
                  {i.short}
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Farbwelt">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              aria-pressed={palette === null}
              onClick={() => setPalette(null)}
              className={cn('inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-medium transition-colors', palette === null ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong bg-surface text-ink hover:bg-sunken')}
            >
              Vorschlag
            </button>
            {PALETTES.map((p, i) => (
              <button
                key={p.name}
                type="button"
                aria-pressed={palette === i}
                aria-label={`Farbwelt ${p.name}`}
                title={p.name}
                onClick={() => setPalette(i)}
                className={cn('relative flex size-10 items-center justify-center rounded-full border border-line-strong transition-shadow', palette === i && 'ring-2 ring-brand ring-offset-2 ring-offset-surface')}
                style={{ background: `linear-gradient(135deg, ${p.backgroundColor} 0 62%, ${p.accentColor} 62% 100%)` }}
              >
                {palette === i ? <Check className="size-4 -translate-x-1 -translate-y-0.5" style={{ color: p.textColor }} strokeWidth={3} aria-hidden /> : null}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Stempel bis zur Prämie">
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={total === c}
                onClick={() => setCount(c)}
                className={cn('tabular h-10 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors', total === c ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-surface text-ink hover:bg-sunken')}
              >
                {c}
              </button>
            ))}
          </div>
        </Group>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor={rangeId} className="flex items-baseline justify-between text-sm font-semibold text-ink">
              Gesammelt
              <span className="tabular text-xs font-normal text-muted">
                {current} von {total}
              </span>
            </label>
            <input id={rangeId} type="range" min={0} max={total} step={1} value={current} onChange={(e) => setBalance(Number(e.target.value))} className="mt-4 h-2 w-full cursor-pointer accent-[var(--brand)]" />
          </div>
          <div>
            <label htmlFor={nameId} className="text-sm font-semibold text-ink">
              Name deines Betriebs
            </label>
            <Input id={nameId} className="mt-2.5" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder={industry.card.organizationName} autoComplete="off" />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">Die Vorschau läuft nur in deinem Browser, es wird nichts gespeichert oder übertragen. Im Karten-Designer kommen Logo, eigene Farbwerte, Prämien und Regeln dazu.</p>
      </div>

      <div className="order-1 lg:order-2">
        <div className="relative flex min-h-[340px] items-center justify-center rounded-[2rem] border border-line bg-sunken px-5 py-12 sm:min-h-[460px] sm:px-10 lg:sticky lg:top-24">
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-60 [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
          <div className="relative w-full max-w-[380px]" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`${industryId}-${palette}`}
                initial={reduce ? false : { opacity: 0, scale: 0.97, rotate: -1.5 }}
                animate={{ opacity: 1, scale: 1, rotate: -2 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              >
                <LoyaltyCard data={data} highlightIndex={current - 1} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
