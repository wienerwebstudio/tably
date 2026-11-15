'use client';
import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { Badge, buttonClass, cn, formatMoney, formatNumber, Segmented } from '@tapperl/ui';
import type { PublicPlan } from './plans';
import { REGISTER_URL } from './site';

type Interval = 'monthly' | 'yearly';

const LIMITS: Array<{ key: keyof PublicPlan['limits']; one: string; many: string }> = [
  { key: 'locations', one: 'Standort', many: 'Standorte' },
  { key: 'devices', one: 'NFC-Stempel', many: 'NFC-Stempel' },
  { key: 'programs', one: 'Kartenprogramm', many: 'Kartenprogramme' },
  { key: 'staff', one: 'Teammitglied', many: 'Teammitglieder' },
  { key: 'customers', one: 'Kund:in', many: 'Kund:innen' },
  { key: 'campaignsPerMonth', one: 'Kampagne pro Monat', many: 'Kampagnen pro Monat' },
];
const FEATURES: Array<{ key: keyof PublicPlan['features']; label: string }> = [
  { key: 'walletPasses', label: 'Wallet-Karten (Apple, Google)' },
  { key: 'emailCampaigns', label: 'E-Mail-Kampagnen' },
  { key: 'automations', label: 'Automationen (Geburtstag, Rückgewinnung)' },
  { key: 'advancedAnalytics', label: 'Erweiterte Analysen' },
  { key: 'posApi', label: 'Kassen-Schnittstelle (API)' },
  { key: 'prioritySupport', label: 'Priorisierter Support' },
];

function limitText(value: number, one: string, many: string): React.ReactNode {
  if (value === -1) return <>Unbegrenzt viele {many}</>;
  return (
    <>
      <span className="tabular font-semibold">{formatNumber(value)}</span> {value === 1 ? one : many}
    </>
  );
}

export function PricingTable({ plans, trialDays, trialPlanId }: { plans: PublicPlan[]; trialDays: number; trialPlanId?: string }) {
  const [interval, setInterval] = React.useState<Interval>('monthly');

  return (
    <div>
      <div className="flex flex-col items-center gap-3">
        <Segmented<Interval>
          label="Abrechnungszeitraum"
          value={interval}
          onChange={setInterval}
          options={[
            { value: 'monthly', label: 'Monatlich' },
            { value: 'yearly', label: 'Jährlich' },
          ]}
        />
        <p className="text-sm text-muted" aria-live="polite">
          {interval === 'yearly' ? 'Jährliche Zahlung: Preis für zwölf Monate im Voraus.' : 'Monatliche Zahlung. Jährlich ist günstiger.'}
        </p>
      </div>

      <div className={cn('mt-10 grid gap-5', plans.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
        {plans.map((plan) => {
          const isFeatured = plan.id === trialPlanId;
          const yearlySaving = plan.priceMonthlyCents * 12 - plan.priceYearlyCents;
          const perMonthYearly = Math.round(plan.priceYearlyCents / 12);
          return (
            <article key={plan.id} className={cn('relative flex flex-col rounded-3xl border bg-surface p-6 sm:p-8', isFeatured ? 'border-brand shadow-raised lg:-my-3 lg:py-11' : 'border-line shadow-card')}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl text-ink">{plan.name}</h2>
                {isFeatured ? <Badge tone="brand">Tarif der Testphase</Badge> : null}
              </div>
              <p className="mt-2 min-h-[4.5rem] text-[15px] leading-relaxed text-muted">{plan.description}</p>

              <p className="mt-6 flex items-baseline gap-2">
                <span className="tabular font-display text-5xl tracking-tight text-ink">{formatMoney(interval === 'monthly' ? plan.priceMonthlyCents : plan.priceYearlyCents, plan.currency)}</span>
                <span className="text-sm text-muted">{interval === 'monthly' ? 'pro Monat' : 'pro Jahr'}</span>
              </p>
              <p className="mt-2 min-h-5 text-sm text-muted">
                {interval === 'yearly' ? (
                  <>
                    entspricht {formatMoney(perMonthYearly, plan.currency)} pro Monat
                    {yearlySaving > 0 ? <span className="font-medium text-success"> · {formatMoney(yearlySaving, plan.currency)} gespart</span> : null}
                  </>
                ) : (
                  <>zzgl. MwSt.</>
                )}
              </p>

              <a href={REGISTER_URL} className={buttonClass({ variant: isFeatured ? 'primary' : 'outline', size: 'lg', className: 'mt-7 w-full rounded-xl' })}>
                {trialDays} Tage kostenlos testen
              </a>

              <h3 className="mt-8 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Umfang</h3>
              <ul className="mt-4 space-y-3 text-[15px] text-ink">
                {LIMITS.map((l) => (
                  <li key={l.key} className="flex gap-3">
                    <Check className="mt-0.5 size-[18px] shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                    <span>{limitText(plan.limits[l.key], l.one, l.many)}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-8 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Funktionen</h3>
              <ul className="mt-4 space-y-3 text-[15px]">
                {FEATURES.map((f) => {
                  const on = plan.features[f.key];
                  return (
                    <li key={f.key} className={cn('flex gap-3', on ? 'text-ink' : 'text-muted')}>
                      {on ? <Check className="mt-0.5 size-[18px] shrink-0 text-brand" strokeWidth={2.5} aria-hidden /> : <Minus className="mt-0.5 size-[18px] shrink-0" aria-hidden />}
                      <span>
                        {f.label}
                        <span className="sr-only">{on ? ' – enthalten' : ' – nicht enthalten'}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
