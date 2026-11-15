'use client';
import * as React from 'react';
import useSWR from 'swr';
import { Check, Minus, Pencil } from 'lucide-react';
import { Badge, Button, Card, cn, defineCopy, EmptyState, formatDateTime, formatMoney, PageHeader, Skeleton, useCopy } from '@tably/ui';
import { featureLabel, limitLabel } from '@/lib/labels';
import { formatLimit, LoadError } from '@/components/admin/shared';
import { PlanEditor } from '@/components/admin/plan-editor';
import { FEATURE_KEYS, LIMIT_KEYS, type AdminPlan } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Tarife',
    description: 'Preise, Limits und Funktionen der Tarife. Änderungen gelten sofort, ohne neue Version.',
    edit: 'Bearbeiten',
    editLabel: (name: string) => `Tarif ${name} bearbeiten`,
    active: 'Buchbar',
    inactive: 'Inaktiv',
    perMonth: 'pro Monat',
    perYear: 'pro Jahr',
    subscriptions: (n: number) => (n === 1 ? '1 Abonnement' : `${n} Abonnements`),
    stripeMonthly: 'Stripe-Preis monatlich',
    stripeYearly: 'Stripe-Preis jährlich',
    notSet: 'nicht hinterlegt',
    updated: (when: string) => `Zuletzt geändert am ${when}`,
    included: 'enthalten',
    notIncluded: 'nicht enthalten',
    emptyTitle: 'Keine Tarife vorhanden',
  },
});

export default function AdminPlansPage() {
  const t = useCopy(copy);
  const plans = useSWR<AdminPlan[]>('/admin/plans');
  const [editing, setEditing] = React.useState<AdminPlan | null>(null);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {plans.error ? (
        <Card><LoadError error={plans.error} onRetry={() => void plans.mutate()} /></Card>
      ) : !plans.data ? (
        <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[32rem] rounded-2xl" />)}</div>
      ) : plans.data.length === 0 ? (
        <Card><EmptyState title={t.emptyTitle} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.data.map((plan) => (
            <Card key={plan.id} className="flex flex-col p-5" data-testid={`admin-plan-${plan.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                    {plan.name}
                    <Badge tone={plan.isActive ? 'success' : 'neutral'}>{plan.isActive ? t.active : t.inactive}</Badge>
                  </h2>
                  <p className="mt-0.5 font-mono text-xs text-muted">{plan.id} · {t.subscriptions(plan._count?.subscriptions ?? 0)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(plan)} aria-label={t.editLabel(plan.name)}><Pencil className="size-3.5" aria-hidden />{t.edit}</Button>
              </div>
              <p className="mt-3 text-sm text-muted">{plan.description}</p>
              <p className="mt-4 text-sm text-muted">
                <span className="text-2xl font-semibold tracking-tight text-ink tabular" data-testid="price-monthly">{formatMoney(plan.priceMonthlyCents, plan.currency)}</span> {t.perMonth}
                <span className="mx-1.5">·</span>
                <span className="font-medium text-ink tabular">{formatMoney(plan.priceYearlyCents, plan.currency)}</span> {t.perYear}
              </p>
              <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
                {LIMIT_KEYS.map((key) => (
                  <div key={key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">{limitLabel[key] ?? key}</dt>
                    <dd className="font-medium tabular">{formatLimit(plan.limits[key])}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
                {FEATURE_KEYS.map((key) => (
                  <li key={key} className={cn('flex items-start gap-2', plan.features[key] ? 'text-ink' : 'text-subtle')}>
                    {plan.features[key] ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />}
                    <span>{featureLabel[key] ?? key}<span className="sr-only"> ({plan.features[key] ? t.included : t.notIncluded})</span></span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
                {([[t.stripeMonthly, plan.stripePriceMonthlyId], [t.stripeYearly, plan.stripePriceYearlyId]] as const).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className={cn('min-w-0 break-all text-right', value ? 'font-mono text-xs' : 'text-subtle')}>{value ?? t.notSet}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-auto pt-4 text-xs text-subtle">{t.updated(formatDateTime(plan.updatedAt))}</p>
            </Card>
          ))}
        </div>
      )}
      {editing ? <PlanEditor key={editing.id} plan={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={() => plans.mutate()} /> : null}
    </>
  );
}
