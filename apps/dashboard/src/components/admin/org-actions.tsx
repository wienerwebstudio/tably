'use client';
import * as React from 'react';
import { TRIAL_DAYS, UNLIMITED } from '@tapperl/config';
import type { PlanLimits } from '@tapperl/config';
import type { SubscriptionStatus } from '@tapperl/types';
import { Alert, api, Button, Card, CardBody, CardHeader, ConfirmDialog, defineCopy, Dialog, errorMessage, Field, Input, Select, Textarea, useCopy, useToast } from '@tapperl/ui';
import { limitLabel, subscriptionStatus } from '@/lib/labels';
import { formatLimit } from './shared';
import { LIMIT_KEYS, type AdminOrgDetail, type AdminPlan } from './types';

const copy = defineCopy({
  de: {
    suspend: 'Betrieb sperren',
    unsuspend: 'Sperre aufheben',
    suspendTitle: (name: string) => `${name} sperren?`,
    suspendText: 'Der Betrieb kann danach nichts mehr ändern, Stempel und Anmeldungen ruhen. Die Daten bleiben erhalten.',
    reason: 'Begründung',
    reasonHint: 'Wird im Protokoll festgehalten.',
    reasonRequired: 'Bitte gib eine Begründung an.',
    suspended: 'Betrieb gesperrt.',
    unsuspendTitle: 'Sperre aufheben?',
    unsuspendText: 'Der Betrieb kann danach wieder uneingeschränkt arbeiten (sofern das Abonnement es zulässt).',
    unsuspended: 'Sperre aufgehoben.',
    cancel: 'Abbrechen',
    subTitle: 'Abonnement ändern',
    subDescription: 'Änderungen wirken sofort und umgehen den Zahlungsanbieter. Bei Stripe-Abos überschreibt der nächste Webhook den Stand wieder.',
    plan: 'Tarif',
    status: 'Abo-Status',
    trialEnds: 'Testphase endet am',
    trialHint: 'Leer lassen, wenn keine Testphase läuft.',
    extendTrial: (days: number) => `+${days} Tage`,
    save: 'Speichern',
    saved: 'Abonnement aktualisiert.',
    nothingChanged: 'Keine Änderungen',
    limitsTitle: 'Individuelle Limits',
    limitsDescription: 'Überschreibt einzelne Limits des Tarifs nur für diesen Betrieb. Leeres Feld = Wert aus dem Tarif, -1 = unbegrenzt.',
    planDefault: (value: string) => `Tarif: ${value}`,
    limitInvalid: 'Ganze Zahl ab -1',
    saveLimits: 'Limits speichern',
    resetLimits: 'Auf Tarif zurücksetzen',
    limitsSaved: 'Individuelle Limits gespeichert.',
    limitsReset: 'Limits auf den Tarif zurückgesetzt.',
    overridesActive: 'Für diesen Betrieb gelten individuelle Limits.',
  },
});

type Patch = (body: Record<string, unknown>) => Promise<void>;

export function useOrgPatch(id: string, onUpdated: (detail: AdminOrgDetail) => void): Patch {
  return React.useCallback(
    async (body) => {
      const detail = await api<AdminOrgDetail>(`/admin/organizations/${id}`, { method: 'PATCH', body });
      onUpdated(detail);
    },
    [id, onUpdated],
  );
}

export function SuspendButton({ detail, patch }: { detail: AdminOrgDetail; patch: Patch }) {
  const t = useCopy(copy);
  const toast = useToast();
  const org = detail.organization;
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await patch(body);
      toast.success(success);
      setOpen(false);
      setReason('');
    } catch (err) {
      if (body.status === 'SUSPENDED') setError(errorMessage(err));
      else (toast.error(errorMessage(err)), setOpen(false));
    } finally {
      setBusy(false);
    }
  };

  if (org.status === 'SUSPENDED') {
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>{t.unsuspend}</Button>
        <ConfirmDialog open={open} onOpenChange={setOpen} title={t.unsuspendTitle} description={t.unsuspendText} confirmLabel={t.unsuspend} loading={busy} onConfirm={() => run({ status: 'ACTIVE' }, t.unsuspended)} />
      </>
    );
  }
  const formId = 'suspend-form';
  return (
    <>
      <Button variant="danger" onClick={() => (setError(null), setOpen(true))}>{t.suspend}</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t.suspendTitle(org.name)}
        description={t.suspendText}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
            <Button type="submit" form={formId} variant="danger" loading={busy}>{t.suspend}</Button>
          </>
        }
      >
        <form method="post"
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason.trim()) return setError(t.reasonRequired);
            void run({ status: 'SUSPENDED', suspendedReason: reason.trim() }, t.suspended);
          }}
          noValidate
        >
          <Field label={t.reason} hint={t.reasonHint} error={error}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} required autoFocus />
          </Field>
        </form>
      </Dialog>
    </>
  );
}

const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE') : '');

export function SubscriptionForm({ detail, plans, patch }: { detail: AdminOrgDetail; plans: AdminPlan[]; patch: Patch }) {
  const t = useCopy(copy);
  const toast = useToast();
  const sub = detail.organization.subscription;
  const [planId, setPlanId] = React.useState(sub?.planId ?? '');
  const [status, setStatus] = React.useState<SubscriptionStatus>(sub?.status ?? 'TRIALING');
  const [trial, setTrial] = React.useState(toDateInput(sub?.trialEndsAt ?? null));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPlanId(sub?.planId ?? '');
    setStatus(sub?.status ?? 'TRIALING');
    setTrial(toDateInput(sub?.trialEndsAt ?? null));
  }, [sub?.planId, sub?.status, sub?.trialEndsAt]);

  if (!sub) return null;
  const body: Record<string, unknown> = {};
  if (planId !== sub.planId) body.planId = planId;
  if (status !== sub.status) body.subscriptionStatus = status;
  if (trial !== toDateInput(sub.trialEndsAt)) body.trialEndsAt = trial ? new Date(`${trial}T23:59:59`).toISOString() : null;
  const dirty = Object.keys(body).length > 0;

  const extend = () => {
    const base = sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date() ? new Date(sub.trialEndsAt) : new Date();
    base.setDate(base.getDate() + TRIAL_DAYS);
    setTrial(base.toLocaleDateString('sv-SE'));
    if (status !== 'TRIALING' && sub.status !== 'ACTIVE') setStatus('TRIALING');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      await patch(body);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t.subTitle} description={t.subDescription} />
      <CardBody>
        <form method="post" className="grid gap-5 sm:grid-cols-2" onSubmit={submit} noValidate>
          {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
          <Field label={t.plan}>
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? '' : ' (inaktiv)'}</option>)}
            </Select>
          </Field>
          <Field label={t.status}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
              {(Object.keys(subscriptionStatus) as SubscriptionStatus[]).map((key) => <option key={key} value={key}>{subscriptionStatus[key].label}</option>)}
            </Select>
          </Field>
          <Field label={t.trialEnds} hint={t.trialHint} className="sm:col-span-2" htmlFor="trial-ends">
            <div className="flex flex-wrap gap-2">
              <Input id="trial-ends" type="date" value={trial} onChange={(e) => setTrial(e.target.value)} className="max-w-48" />
              <Button variant="outline" onClick={extend}>{t.extendTrial(TRIAL_DAYS)}</Button>
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} disabled={!dirty}>{dirty ? t.save : t.nothingChanged}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function LimitOverridesForm({ detail, patch }: { detail: AdminOrgDetail; patch: Patch }) {
  const t = useCopy(copy);
  const toast = useToast();
  const sub = detail.organization.subscription;
  const overrides = sub?.limitOverrides ?? null;
  const initial = React.useMemo(() => Object.fromEntries(LIMIT_KEYS.map((key) => [key, overrides?.[key] !== undefined && overrides?.[key] !== null ? String(overrides[key]) : ''])) as Record<keyof PlanLimits, string>, [overrides]);
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Partial<Record<keyof PlanLimits, string>>>({});
  const [busy, setBusy] = React.useState<'save' | 'reset' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setValues(initial), [initial]);

  if (!sub) return null;
  const planLimits = sub.plan.limits;
  const dirty = LIMIT_KEYS.some((key) => values[key].trim() !== initial[key]);

  const send = async (limitOverrides: Partial<PlanLimits> | null, kind: 'save' | 'reset') => {
    setBusy(kind);
    setError(null);
    try {
      await patch({ limitOverrides });
      toast.success(limitOverrides ? t.limitsSaved : t.limitsReset);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<PlanLimits> = {};
    const problems: Partial<Record<keyof PlanLimits, string>> = {};
    for (const key of LIMIT_KEYS) {
      const raw = values[key].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < UNLIMITED || n > 10_000_000) problems[key] = t.limitInvalid;
      else next[key] = n;
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
    void send(Object.keys(next).length ? next : null, 'save');
  };

  return (
    <Card>
      <CardHeader title={t.limitsTitle} description={t.limitsDescription} />
      <CardBody>
        <form method="post" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submit} noValidate>
          {error ? <Alert tone="danger" className="sm:col-span-2 lg:col-span-3">{error}</Alert> : null}
          {overrides && Object.keys(overrides).length ? <Alert tone="info" className="sm:col-span-2 lg:col-span-3">{t.overridesActive}</Alert> : null}
          {LIMIT_KEYS.map((key) => (
            <Field key={key} label={limitLabel[key] ?? key} hint={t.planDefault(formatLimit(planLimits[key]))} error={errors[key]}>
              <Input name={`limit-${key}`} type="number" inputMode="numeric" min={-1} step={1} value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} placeholder={String(planLimits[key])} />
            </Field>
          ))}
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" loading={busy === 'save'} disabled={!dirty || busy === 'reset'}>{t.saveLimits}</Button>
            <Button variant="outline" loading={busy === 'reset'} disabled={!overrides || busy === 'save'} onClick={() => void send(null, 'reset')}>{t.resetLimits}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
