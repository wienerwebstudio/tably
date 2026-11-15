'use client';
import * as React from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { Check, Gift, Nfc } from 'lucide-react';
import { cn, LoyaltyCard, PhoneFrame } from '@tably/ui';
import { HERO_CARD } from './site';
import { StampSide } from './stamp';

type Phase = 'idle' | 'tap' | 'notify' | 'press' | 'stamped';
const DURATION: Record<Phase, number> = { idle: 1300, tap: 1000, notify: 1300, press: 450, stamped: 1900 };
const NEXT: Record<Phase, Phase> = { idle: 'tap', tap: 'notify', notify: 'press', press: 'stamped', stamped: 'idle' };
const START = 7;
const TOTAL = HERO_CARD.stampsRequired;

const STEPS: Array<{ label: string; active: (p: Phase, full: boolean) => boolean }> = [
  { label: 'Stempel ans Handy', active: (p) => p === 'tap' },
  { label: 'Mitteilung antippen', active: (p) => p === 'notify' || p === 'press' },
  { label: 'Stempel gebucht', active: (p, full) => p === 'stamped' && !full },
  { label: 'Prämie frei', active: (p, full) => p === 'stamped' && full },
];

/**
 * Die Produktbühne im Hero: Stempel tippt aufs Smartphone, die Mitteilung
 * erscheint, wird angetippt, der Stempel landet auf der Karte. Läuft als
 * Schleife; ohne JavaScript oder bei reduzierter Bewegung steht ein ruhiges
 * Standbild.
 */
export function HeroDemo() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [balance, setBalance] = React.useState(START);
  const full = balance >= TOTAL;

  React.useEffect(() => {
    if (reduce || !inView) return;
    const wait = phase === 'stamped' && full ? 3400 : DURATION[phase];
    const t = window.setTimeout(() => {
      const next = NEXT[phase];
      if (next === 'stamped') setBalance((b) => b + 1);
      if (phase === 'stamped' && full) setBalance(START);
      setPhase(next);
    }, wait);
    return () => window.clearTimeout(t);
  }, [phase, full, reduce, inView]);

  const down = phase === 'tap';
  const showBanner = phase === 'notify' || phase === 'press';

  return (
    <figure ref={ref} className="relative mx-auto w-full max-w-[400px]">
      <figcaption className="sr-only">
        Darstellung des Ablaufs: Der Stempel wird an das Smartphone gehalten, auf dem Smartphone erscheint eine Mitteilung, nach dem Antippen wird ein Stempel auf der digitalen Karte gebucht. Ist die Karte voll, wird die Prämie freigeschaltet.
      </figcaption>

      <div className="relative px-6 pt-16 sm:px-10" aria-hidden>
        {/* ruhiger Hintergrundkreis */}
        <div className="absolute left-1/2 top-24 -z-10 size-[26rem] max-w-[120%] -translate-x-1/2 rounded-full bg-brand-soft/70" />

        {/* Funkwellen an der Kontaktstelle */}
        <div className="pointer-events-none absolute right-[21%] top-[5.2rem] z-20 size-0">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-honey"
              initial={false}
              animate={down ? { scale: [0.3, 1.5], opacity: [0.7, 0] } : { scale: 0.3, opacity: 0 }}
              transition={down ? { duration: 0.9, delay: 0.25 + i * 0.16, ease: 'easeOut' } : { duration: 0.1 }}
            />
          ))}
        </div>

        {/* der Stempel */}
        <motion.div
          className="absolute right-[4%] top-0 z-30 w-[23%] origin-bottom drop-shadow-[0_18px_18px_rgb(20_24_27/0.25)]"
          initial={false}
          animate={down ? { y: 10, x: -6, rotate: -10 } : { y: -30, x: 4, rotate: -16 }}
          transition={{ type: 'spring', stiffness: 170, damping: 17 }}
        >
          <StampSide />
        </motion.div>

        <PhoneFrame className="max-w-[300px]" label="Smartphone mit digitaler Treuekarte">
          <div className="relative flex h-[500px] flex-col bg-paper px-3.5 pb-4 pt-10">
            <AnimatePresence>
              {showBanner ? (
                <motion.div
                  key="banner"
                  className="absolute inset-x-2.5 top-8 z-20 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-raised backdrop-blur"
                  initial={{ y: -70, opacity: 0 }}
                  animate={{ y: 0, opacity: 1, scale: phase === 'press' ? 0.96 : 1 }}
                  exit={{ y: -20, opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink">
                    <Nfc className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-subtle">NFC-Tag erkannt</span>
                    <span className="block truncate text-[13px] font-medium text-ink">Karte von Café Morgenrot öffnen</span>
                  </span>
                  <motion.span
                    className="absolute right-6 top-1/2 size-9 -translate-y-1/2 rounded-full bg-brand/25"
                    initial={false}
                    animate={phase === 'press' ? { scale: [0.4, 1.3], opacity: [0.9, 0] } : { scale: 0.4, opacity: 0 }}
                    transition={{ duration: 0.45 }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex items-center justify-between px-1.5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-subtle">Deine Karte</p>
                <p className="text-[15px] font-semibold text-ink">Hallo Lena</p>
              </div>
              <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-xs font-semibold text-muted">L</span>
            </div>

            <LoyaltyCard compact className="mt-4 rounded-[22px] shadow-raised" data={{ ...HERO_CARD, balance }} highlightIndex={phase === 'stamped' ? balance - 1 : null} />

            <div className="mt-3.5 min-h-[58px]">
              <AnimatePresence mode="wait" initial={false}>
                {phase === 'stamped' ? (
                  <motion.div
                    key={full ? 'reward' : `stamp-${balance}`}
                    className={cn('flex items-center gap-3 rounded-2xl border p-3', full ? 'border-honey/40 bg-honey-soft' : 'border-line bg-surface')}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.3 }}
                  >
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', full ? 'bg-honey text-white' : 'bg-success-soft text-success')}>
                      {full ? <Gift className="size-4" /> : <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">{full ? 'Karte voll – Prämie frei' : 'Stempel gebucht'}</span>
                      <span className="block truncate text-xs text-muted">{full ? 'Gratis Kaffee jetzt einlösbar' : `Noch ${TOTAL - balance} bis zum Gratis Kaffee`}</span>
                    </span>
                  </motion.div>
                ) : (
                  <motion.div key="hint" className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted">
                      <Nfc className="size-4" />
                    </span>
                    <span className="text-xs leading-snug text-muted">Beim nächsten Besuch einfach wieder stempeln lassen.</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2">
              <span className="flex h-9 items-center justify-center rounded-lg bg-sunken text-xs font-medium text-muted">Verlauf</span>
              <span className="flex h-9 items-center justify-center rounded-lg bg-sunken text-xs font-medium text-muted">Zur Wallet</span>
            </div>
          </div>
        </PhoneFrame>
      </div>

      <ol className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
        {STEPS.map((step, i) => {
          const active = !reduce && step.active(phase, full);
          return (
            <li
              key={step.label}
              className={cn(
                'flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[12px] font-medium leading-tight transition-colors duration-300 sm:flex-col sm:items-start sm:rounded-xl sm:px-3 sm:py-2.5',
                active ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-muted',
              )}
            >
              <span className={cn('tabular text-[11px]', active ? 'text-white/70' : 'text-subtle')}>0{i + 1}</span>
              {step.label}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
