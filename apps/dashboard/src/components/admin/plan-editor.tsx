'use client';
import * as React from 'react';
import { UNLIMITED } from '@tapperl/config';
import type { PlanFeatures, PlanLimits } from '@tapperl/config';
import { Alert, api, ApiError, Button, defineCopy, Dialog, Field, Input, Switch, Textarea, useCopy, useToast } from '@tapperl/ui';
import { featureLabel, limitLabel } from '@/lib/labels';
import { centsToEuroInput, parseEuro } from './shared';
import { FEATURE_KEYS, LIMIT_KEYS, type AdminPlan } from './types';

const copy = defineCopy({
  de: {
    title: (name: string) => `Tarif ${name} bearbeiten`,
    description: 'Änderungen gelten sofort für alle Betriebe in diesem Tarif. Preise wirken sich nur im Testmodus direkt aus – bei Stripe zählt der hinterlegte Stripe-Preis.',
    name: 'Name',
    descriptionLabel: 'Beschreibung',
    priceMonthly: 'Preis pro Monat (€)',
    priceYearly: 'Preis pro Jahr (€)',
    priceHint: 'In Euro, z. B. 29 oder 29,90',
    priceInvalid: 'Bitte gib einen Betrag in Euro an, z. B. 29,90.',
    limits: 'Limits',
    limitsHint: '-1 bedeutet unbegrenzt.',
    limitInvalid: 'Ganze Zahl ab -1',
    features: 'Funktionen',
    stripe: 'Stripe-Preis-IDs',
    stripeHint: 'Ohne Preis-ID kann dieser Tarif mit Stripe nicht gebucht werden.',
    stripeMonthly: 'Preis-ID monatlich',
    stripeYearly: 'Preis-ID jährlich',
    active: 'Tarif ist buchbar',
    activeHint: 'Inaktive Tarife erscheinen nicht mehr in der Tarifauswahl. Bestehende Abos laufen weiter.',
    cancel: 'Abbrechen',
    save: 'Tarif speichern',
    saved: (name: string) => `Tarif ${name} gespeichert.`,
    nameRequired: 'Bitte gib einen Namen an.',
    fixErrors: 'Bitte prüfe die markierten Felder.',
  },
});

export function PlanEditor({ plan, onOpenChange, onSaved }: { plan: AdminPlan; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [name, setName] = React.useState(plan.name);
  const [description, setDescription] = React.useState(plan.description);
  const [monthly, setMonthly] = React.useState(centsToEuroInput(plan.priceMonthlyCents));
  const [yearly, setYearly] = React.useState(centsToEuroInput(plan.priceYearlyCents));
  const [limits, setLimits] = React.useState(() => Object.fromEntries(LIMIT_KEYS.map((key) => [key, String(plan.limits[key])])) as Record<keyof PlanLimits, string>);
  const [features, setFeatures] = React.useState<PlanFeatures>({ ...plan.features });
  const [stripeMonthly, setStripeMonthly] = React.useState(plan.stripePriceMonthlyId ?? '');
  const [stripeYearly, setStripeYearly] = React.useState(plan.stripePriceYearlyId ?? '');
  const [isActive, setIsActive] = React.useState(plan.isActive);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const formId = React.useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problems: Record<string, string> = {};
    const priceMonthlyCents = parseEuro(monthly);
    const priceYearlyCents = parseEuro(yearly);
    if (!name.trim()) problems.name = t.nameRequired;
    if (priceMonthlyCents === null) problems.priceMonthly = t.priceInvalid;
    if (priceYearlyCents === null) problems.priceYearly = t.priceInvalid;
    const parsedLimits = {} as PlanLimits;
    for (const key of LIMIT_KEYS) {
      const n = Number(limits[key].trim());
      if (limits[key].trim() === '' || !Number.isInteger(n) || n < UNLIMITED || n > 10_000_000) problems[`limit-${key}`] = t.limitInvalid;
      else parsedLimits[key] = n;
    }
    setErrors(problems);
    if (Object.keys(problems).length) return setError(t.fixErrors);
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/plans/${plan.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), description: description.trim(), priceMonthlyCents, priceYearlyCents, limits: parsedLimits, features, stripePriceMonthlyId: stripeMonthly.trim() || null, stripePriceYearlyId: stripeYearly.trim() || null, isActive },
      });
      await onSaved();
      toast.success(t.saved(name.trim()));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.message);
      } else setError('Unerwarteter Fehler. Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !busy && onOpenChange(open)}
      title={t.title(plan.name)}
      description={t.description}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t.cancel}</Button>
          <Button type="submit" form={formId} loading={busy}>{t.save}</Button>
        </>
      }
    >
      <form method="post" id={formId} className="flex flex-col gap-6" onSubmit={submit} noValidate>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.name} error={errors.name} className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </Field>
          <Field label={t.descriptionLabel} error={errors.description} className="sm:col-span-2">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="min-h-20" />
          </Field>
          <Field label={t.priceMonthly} error={errors.priceMonthly ?? errors.priceMonthlyCents} hint={t.priceHint}>
            <Input name="priceMonthly" value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" required />
          </Field>
          <Field label={t.priceYearly} error={errors.priceYearly ?? errors.priceYearlyCents} hint={t.priceHint}>
            <Input name="priceYearly" value={yearly} onChange={(e) => setYearly(e.target.value)} inputMode="decimal" required />
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t.limits}</legend>
          <p className="text-sm text-muted">{t.limitsHint}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {LIMIT_KEYS.map((key) => (
              <Field key={key} label={limitLabel[key] ?? key} error={errors[`limit-${key}`]}>
                <Input name={`limit-${key}`} type="number" inputMode="numeric" min={-1} step={1} value={limits[key]} onChange={(e) => setLimits((v) => ({ ...v, [key]: e.target.value }))} required />
              </Field>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t.features}</legend>
          <div className="mt-3 flex flex-col gap-3">
            {FEATURE_KEYS.map((key) => <Switch key={key} label={featureLabel[key] ?? key} checked={features[key]} onCheckedChange={(v) => setFeatures((f) => ({ ...f, [key]: v }))} />)}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t.stripe}</legend>
          <p className="text-sm text-muted">{t.stripeHint}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label={t.stripeMonthly} error={errors.stripePriceMonthlyId} optional>
              <Input value={stripeMonthly} onChange={(e) => setStripeMonthly(e.target.value)} maxLength={80} placeholder="price_…" spellCheck={false} className="font-mono" />
            </Field>
            <Field label={t.stripeYearly} error={errors.stripePriceYearlyId} optional>
              <Input value={stripeYearly} onChange={(e) => setStripeYearly(e.target.value)} maxLength={80} placeholder="price_…" spellCheck={false} className="font-mono" />
            </Field>
          </div>
        </fieldset>

        <Switch label={t.active} description={t.activeHint} checked={isActive} onCheckedChange={setIsActive} />
      </form>
    </Dialog>
  );
}
