'use client';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Check, ExternalLink, FlaskConical, Minus, Receipt } from 'lucide-react';
import type { PlanFeatures, PlanLimits } from '@tapperl/config';
import type { BillingDto, PlanDto } from '@tapperl/types';
import { Alert, api, ApiError, Badge, Button, Card, CardBody, CardHeader, cn, ConfirmDialog, DefinitionList, defineCopy, Dialog, EmptyState, ErrorState, errorMessage, formatDate, formatMoney, Segmented, Skeleton, Table, Td, Th, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { featureLabel, limitLabel, subscriptionStatus } from '@/lib/labels';
import { formatLimit, Stack, UsageBar } from './shared';

const copy = defineCopy({
  de: {
    localTitle: 'Testmodus',
    localText: 'Testmodus: Es ist kein Zahlungsanbieter angebunden. Tarifwechsel wirken sofort, es fließt kein Geld.',
    checkoutSuccessTitle: 'Zahlung abgeschlossen',
    checkoutSuccess: 'Danke! Dein Tarif wird in wenigen Augenblicken aktiviert. Falls der Stand hier noch nicht stimmt, lade die Seite kurz neu.',
    checkoutCancelTitle: 'Zahlung abgebrochen',
    checkoutCancel: 'Es wurde nichts gebucht. Du kannst jederzeit einen Tarif wählen.',
    readOnly: 'Nur Inhaber:innen können den Tarif ändern oder kündigen.',
    currentTitle: 'Dein Tarif',
    plan: 'Tarif',
    status: 'Status',
    billingInterval: 'Abrechnung',
    monthly: 'monatlich',
    yearly: 'jährlich',
    trialEnds: 'Testphase endet am',
    renews: 'Nächste Verlängerung',
    endsOn: 'Endet am',
    pastDueSince: 'Zahlung offen seit',
    noPeriod: 'noch kein bezahlter Zeitraum',
    cancelPending: 'Gekündigt',
    cancelPendingText: (date: string) => `Dein Abonnement ist gekündigt und läuft am ${date} aus. Bis dahin kannst du alles wie gewohnt nutzen.`,
    restrictedText: 'Dein Konto ist eingeschränkt: Stempel, Anmeldungen und Änderungen ruhen, bis ein Tarif aktiv ist. Wähle unten einen Tarif.',
    trialText: 'Während der Testphase gelten die unten gezeigten Limits. Wähle rechtzeitig einen Tarif, damit dein Treueprogramm ohne Unterbrechung weiterläuft.',
    cancel: 'Abonnement kündigen',
    resume: 'Kündigung zurücknehmen',
    portal: 'Zahlungsdaten und Rechnungen verwalten',
    cancelTitle: 'Abonnement kündigen?',
    cancelText: (date: string | null) => (date ? `Dein Tarif läuft bis zum ${date} weiter und endet dann. Bis dahin kannst du die Kündigung jederzeit zurücknehmen.` : 'Dein Tarif endet zum Ablauf des bezahlten Zeitraums. Bis dahin kannst du die Kündigung jederzeit zurücknehmen.'),
    cancelConfirm: 'Jetzt kündigen',
    keep: 'Behalten',
    canceled: 'Dein Abonnement wurde gekündigt.',
    resumeTitle: 'Kündigung zurücknehmen?',
    resumeText: 'Dein Abonnement verlängert sich danach wieder automatisch.',
    resumeConfirm: 'Abonnement fortsetzen',
    resumed: 'Die Kündigung wurde zurückgenommen.',
    usageTitle: 'Nutzung',
    usageDescription: 'So viel von deinem Tarif nutzt du gerade.',
    plansTitle: 'Tarife vergleichen',
    intervalLabel: 'Zahlungsweise',
    perMonth: 'pro Monat',
    perYear: 'pro Jahr',
    equalsMonthly: (price: string) => `entspricht ${price} pro Monat`,
    currentBadge: 'Aktuell',
    trialBadge: 'Deine Testphase',
    currentPlan: 'Aktueller Tarif',
    choose: (name: string) => `${name} buchen`,
    switchTo: (name: string) => `Zu ${name} wechseln`,
    switchInterval: (interval: string) => `Auf ${interval}e Zahlung umstellen`,
    included: 'enthalten',
    notIncluded: 'nicht enthalten',
    changeTitle: (name: string) => `Zu ${name} wechseln?`,
    changeLocal: 'Im Testmodus wirkt der Wechsel sofort. Es wird eine Testrechnung ohne Zahlung angelegt.',
    changeStripe: 'Falls noch keine Zahlungsart hinterlegt ist, leiten wir dich zur sicheren Zahlungsseite weiter. Bei einem laufenden Abonnement wird der Wechsel anteilig verrechnet.',
    changeConfirm: 'Tarif wechseln',
    back: 'Abbrechen',
    changed: (name: string) => `Dein Tarif ist jetzt ${name}.`,
    tooSmallTitle: 'Dieser Tarif ist für deine aktuelle Nutzung zu klein',
    tooSmallText: 'Reduziere zuerst die Nutzung (zum Beispiel Standorte deaktivieren oder Teammitglieder entfernen) und versuche es dann erneut.',
    invoicesTitle: 'Rechnungen',
    invoicesEmptyTitle: 'Noch keine Rechnungen',
    invoicesEmptyText: 'Sobald du einen Tarif buchst, erscheinen deine Rechnungen hier.',
    colNumber: 'Nummer',
    colDate: 'Datum',
    colDescription: 'Beschreibung',
    colAmount: 'Betrag',
    colStatus: 'Status',
    colLinks: 'Dokumente',
    testInvoice: 'Testmodus – keine Zahlung',
    view: 'Ansehen',
    pdf: 'PDF',
    simulateTitle: 'Zahlungsereignisse testen',
    simulateBadge: 'Testwerkzeug',
    simulateText: 'Nur im Testmodus verfügbar. Damit stellst du nach, wie sich dein Konto bei Zahlungsproblemen verhält. Es werden keine echten Zahlungen ausgelöst.',
    simFailed: 'Zahlung fehlgeschlagen',
    simFailedHint: 'Setzt den Status auf „Zahlung offen“. Das Konto bleibt zunächst nutzbar.',
    simGrace: 'Kulanzzeit abgelaufen',
    simGraceHint: 'Die Zahlung ist seit Langem offen: Das Konto wird eingeschränkt.',
    simSucceeded: 'Zahlung erfolgreich',
    simSucceededHint: 'Setzt den Status zurück auf „Aktiv“.',
    simulate: 'Auslösen',
    simulated: 'Testereignis ausgelöst.',
    loadError: 'Die Abrechnungsdaten konnten nicht geladen werden.',
  },
});

type Interval = 'MONTH' | 'YEAR';
const LIMIT_KEYS: Array<keyof PlanLimits> = ['locations', 'devices', 'programs', 'staff', 'customers', 'campaignsPerMonth'];
const FEATURE_KEYS: Array<keyof PlanFeatures> = ['walletPasses', 'emailCampaigns', 'automations', 'advancedAnalytics', 'posApi', 'prioritySupport'];
const INVOICE_STATUS: Record<string, { label: string; tone: 'success' | 'warn' | 'neutral' | 'danger' | 'info' }> = {
  paid: { label: 'Bezahlt', tone: 'success' },
  open: { label: 'Offen', tone: 'warn' },
  draft: { label: 'Entwurf', tone: 'neutral' },
  void: { label: 'Storniert', tone: 'neutral' },
  uncollectible: { label: 'Uneinbringlich', tone: 'danger' },
};

function PlanCard({ plan, interval, billing, canManage, onChoose }: { plan: PlanDto; interval: Interval; billing: BillingDto; canManage: boolean; onChoose: (plan: PlanDto) => void }) {
  const t = useCopy(copy);
  const sub = billing.subscription;
  const isCurrent = sub.planId === plan.id;
  const trialing = sub.status === 'TRIALING';
  const running = sub.status === 'ACTIVE' || sub.status === 'PAST_DUE';
  const samePlanAndInterval = isCurrent && running && sub.interval === interval;
  const price = interval === 'YEAR' ? plan.priceYearlyCents : plan.priceMonthlyCents;
  const label = samePlanAndInterval ? t.currentPlan : isCurrent && running ? t.switchInterval(interval === 'YEAR' ? t.yearly : t.monthly) : isCurrent || !running ? t.choose(plan.name) : t.switchTo(plan.name);

  return (
    <div className={cn('flex flex-col rounded-2xl border bg-surface p-5', isCurrent ? 'border-brand ring-1 ring-brand' : 'border-line')} data-testid={`plan-${plan.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
        {isCurrent ? <Badge tone="brand">{trialing ? t.trialBadge : t.currentBadge}</Badge> : null}
      </div>
      <p className="mt-1 min-h-10 text-sm text-muted">{plan.description}</p>
      <p className="mt-4">
        <span className="text-3xl font-semibold tracking-tight text-ink tabular">{formatMoney(price, plan.currency)}</span>{' '}
        <span className="text-sm text-muted">{interval === 'YEAR' ? t.perYear : t.perMonth}</span>
      </p>
      <p className="mt-1 min-h-5 text-xs text-muted">{interval === 'YEAR' ? t.equalsMonthly(formatMoney(Math.round(plan.priceYearlyCents / 12), plan.currency)) : ''}</p>
      {canManage ? (
        <Button className="mt-4" variant={isCurrent ? 'outline' : 'primary'} disabled={samePlanAndInterval} onClick={() => onChoose(plan)}>
          {label}
        </Button>
      ) : null}
      <dl className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
        {LIMIT_KEYS.map((key) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{limitLabel[key] ?? key}</dt>
            <dd className="font-medium text-ink tabular">{formatLimit(plan.limits[key])}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
        {FEATURE_KEYS.map((key) => (
          <li key={key} className={cn('flex items-start gap-2', plan.features[key] ? 'text-ink' : 'text-subtle')}>
            {plan.features[key] ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>
              {featureLabel[key] ?? key}
              <span className="sr-only"> ({plan.features[key] ? t.included : t.notIncluded})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimulateTools({ onDone }: { onDone: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const events = [
    { event: 'payment_failed', label: t.simFailed, hint: t.simFailedHint },
    { event: 'grace_expired', label: t.simGrace, hint: t.simGraceHint },
    { event: 'payment_succeeded', label: t.simSucceeded, hint: t.simSucceededHint },
  ] as const;
  const run = async (event: string) => {
    setPending(event);
    try {
      await api('/billing/test/simulate', { body: { event } });
      await onDone();
      toast.success(t.simulated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };
  return (
    <details className="group rounded-2xl border border-dashed border-line-strong bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-medium text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
        <FlaskConical className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">{t.simulateTitle}</span>
        <Badge tone="honey">{t.simulateBadge}</Badge>
      </summary>
      <div className="border-t border-line px-5 py-4 sm:px-6">
        <p className="text-sm text-muted">{t.simulateText}</p>
        <ul className="mt-4 flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.event} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink">{e.label}</p>
                <p className="text-muted">{e.hint}</p>
              </div>
              <Button variant="outline" size="sm" className="self-start sm:self-auto" loading={pending === e.event} disabled={pending !== null && pending !== e.event} onClick={() => void run(e.event)} data-testid={`simulate-${e.event}`}>
                {t.simulate}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function BillingSettings() {
  const t = useCopy(copy);
  const { can, refresh } = useSession();
  const toast = useToast();
  const params = useSearchParams();
  const checkout = params.get('checkout');
  const canManage = can('billing.manage');
  const billing = useSWR<BillingDto>('/billing');
  const [interval, setIntervalValue] = React.useState<Interval | null>(null);
  const [target, setTarget] = React.useState<PlanDto | null>(null);
  const [changing, setChanging] = React.useState(false);
  const [changeError, setChangeError] = React.useState<{ message: string; over: string[] | null } | null>(null);
  const [confirm, setConfirm] = React.useState<'cancel' | 'resume' | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [portalBusy, setPortalBusy] = React.useState(false);

  const reload = async () => {
    await billing.mutate();
    await refresh();
  };

  if (billing.error) return <Card><ErrorState description={t.loadError} onRetry={() => void billing.mutate()} /></Card>;
  if (!billing.data) return <Stack><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></Stack>;

  const data = billing.data;
  const sub = data.subscription;
  const activeInterval: Interval = interval ?? sub.interval;
  const currentPlan = data.plans.find((p) => p.id === sub.planId);
  const status = subscriptionStatus[sub.status];
  const running = sub.status === 'ACTIVE' || sub.status === 'PAST_DUE';

  const changePlan = async () => {
    if (!target) return;
    setChanging(true);
    setChangeError(null);
    try {
      const res = await api<{ checkoutUrl?: string; applied: boolean }>('/billing/change-plan', { body: { planId: target.id, interval: activeInterval } });
      if (res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      await reload();
      toast.success(t.changed(target.name));
      setTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'limit_reached') {
        const over = Array.isArray(err.details.over) ? err.details.over.filter((o): o is string => typeof o === 'string') : null;
        setChangeError({ message: err.message, over });
      } else setChangeError({ message: errorMessage(err), over: null });
    } finally {
      setChanging(false);
    }
  };

  const setCancel = async (cancel: boolean) => {
    setBusy(true);
    try {
      await api(cancel ? '/billing/cancel' : '/billing/resume', { method: 'POST' });
      await reload();
      toast.success(cancel ? t.canceled : t.resumed);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const res = await api<{ url: string }>('/billing/portal', { method: 'POST' });
      window.location.assign(res.url);
    } catch (err) {
      toast.error(errorMessage(err));
      setPortalBusy(false);
    }
  };

  const summary: Array<{ label: React.ReactNode; value: React.ReactNode }> = [
    { label: t.plan, value: currentPlan?.name ?? sub.planId },
    { label: t.status, value: <span className="inline-flex flex-wrap justify-end gap-1.5"><Badge tone={status.tone} dot>{status.label}</Badge>{sub.cancelAtPeriodEnd && running ? <Badge tone="warn">{t.cancelPending}</Badge> : null}</span> },
  ];
  if (sub.status === 'TRIALING') summary.push({ label: t.trialEnds, value: formatDate(sub.trialEndsAt) });
  else {
    summary.push({ label: t.billingInterval, value: `${sub.interval === 'YEAR' ? t.yearly : t.monthly}${currentPlan ? ` · ${formatMoney(sub.interval === 'YEAR' ? currentPlan.priceYearlyCents : currentPlan.priceMonthlyCents, currentPlan.currency)}` : ''}` });
    summary.push({ label: sub.cancelAtPeriodEnd || sub.status === 'CANCELED' ? t.endsOn : t.renews, value: sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : t.noPeriod });
  }
  if (sub.pastDueSince) summary.push({ label: t.pastDueSince, value: formatDate(sub.pastDueSince) });

  return (
    <Stack>
      {checkout === 'success' ? <Alert tone="success" title={t.checkoutSuccessTitle}>{t.checkoutSuccess}</Alert> : null}
      {checkout === 'cancel' ? <Alert tone="warn" title={t.checkoutCancelTitle}>{t.checkoutCancel}</Alert> : null}
      {data.mode === 'local' ? <Alert tone="warn" title={t.localTitle}>{t.localText}</Alert> : null}
      {!canManage ? <Alert tone="info">{t.readOnly}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.currentTitle} />
          <CardBody className="pt-3">
            <DefinitionList items={summary} />
            {sub.status === 'TRIALING' ? <p className="mt-4 text-sm text-muted">{t.trialText}</p> : null}
            {!sub.writable ? <Alert tone="danger" className="mt-4">{t.restrictedText}</Alert> : null}
            {sub.cancelAtPeriodEnd && running && sub.currentPeriodEnd ? <p className="mt-4 text-sm text-muted">{t.cancelPendingText(formatDate(sub.currentPeriodEnd))}</p> : null}
            {canManage && (running || data.mode === 'stripe') ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {data.mode === 'stripe' ? (
                  <Button variant="outline" size="sm" loading={portalBusy} onClick={() => void openPortal()}>
                    {t.portal}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
                {running ? (
                  sub.cancelAtPeriodEnd ? (
                    <Button variant="outline" size="sm" onClick={() => setConfirm('resume')}>{t.resume}</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setConfirm('cancel')}>{t.cancel}</Button>
                  )
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.usageTitle} description={t.usageDescription} />
          <CardBody className="flex flex-col gap-4">
            {LIMIT_KEYS.map((key) => <UsageBar key={key} label={limitLabel[key] ?? key} used={data.usage[key]} limit={data.limits[key]} />)}
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="plans-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-heading" className="text-base font-semibold text-ink">{t.plansTitle}</h2>
          <Segmented label={t.intervalLabel} value={activeInterval} onChange={setIntervalValue} options={[{ value: 'MONTH', label: t.monthly }, { value: 'YEAR', label: t.yearly }]} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {data.plans.map((plan) => <PlanCard key={plan.id} plan={plan} interval={activeInterval} billing={data} canManage={canManage} onChoose={(p) => (setChangeError(null), setTarget(p))} />)}
        </div>
      </section>

      <Card>
        <CardHeader title={t.invoicesTitle} />
        {data.invoices.length === 0 ? (
          <EmptyState icon={<Receipt />} title={t.invoicesEmptyTitle} description={t.invoicesEmptyText} />
        ) : (
          <div className="mt-4 border-t border-line">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colNumber}</Th>
                  <Th>{t.colDate}</Th>
                  <Th className="hidden md:table-cell">{t.colDescription}</Th>
                  <Th className="text-right">{t.colAmount}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th aria-label={t.colLinks} />
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status];
                  return (
                    <tr key={inv.id}>
                      <Td className="whitespace-nowrap font-medium">{inv.number}</Td>
                      <Td className="whitespace-nowrap text-muted">{formatDate(inv.createdAt)}</Td>
                      <Td className="hidden min-w-56 text-muted md:table-cell">{inv.description}</Td>
                      <Td className="whitespace-nowrap text-right tabular">{formatMoney(inv.amountCents, inv.currency)}</Td>
                      <Td>{inv.isTest ? <Badge tone="honey">{t.testInvoice}</Badge> : <Badge tone={st?.tone ?? 'neutral'}>{st?.label ?? inv.status}</Badge>}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {inv.hostedUrl ? <a href={inv.hostedUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">{t.view}</a> : null}
                        {inv.hostedUrl && inv.pdfUrl ? <span className="text-subtle"> · </span> : null}
                        {inv.pdfUrl ? <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">{t.pdf}</a> : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {data.mode === 'local' && canManage ? <SimulateTools onDone={reload} /> : null}

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && !changing && setTarget(null)}
        title={target ? t.changeTitle(target.name) : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={changing}>{t.back}</Button>
            <Button loading={changing} onClick={() => void changePlan()} data-testid="confirm-change-plan">{t.changeConfirm}</Button>
          </>
        }
      >
        {target ? (
          <div className="flex flex-col gap-4">
            {changeError ? (
              changeError.over ? (
                <Alert tone="warn" title={t.tooSmallTitle}>
                  <ul className="list-disc pl-5">{changeError.over.map((line) => <li key={line}>{line}</li>)}</ul>
                  <p className="mt-2">{t.tooSmallText}</p>
                </Alert>
              ) : (
                <Alert tone="danger">{changeError.message}</Alert>
              )
            ) : null}
            <DefinitionList
              items={[
                { label: t.plan, value: target.name },
                { label: t.billingInterval, value: activeInterval === 'YEAR' ? t.yearly : t.monthly },
                { label: t.colAmount, value: `${formatMoney(activeInterval === 'YEAR' ? target.priceYearlyCents : target.priceMonthlyCents, target.currency)} ${activeInterval === 'YEAR' ? t.perYear : t.perMonth}` },
              ]}
            />
            <p className="text-sm text-muted">{data.mode === 'local' ? t.changeLocal : t.changeStripe}</p>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog open={confirm === 'cancel'} onOpenChange={(open) => !open && setConfirm(null)} title={t.cancelTitle} description={t.cancelText(sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null)} confirmLabel={t.cancelConfirm} cancelLabel={t.keep} danger loading={busy} onConfirm={() => setCancel(true)} />
      <ConfirmDialog open={confirm === 'resume'} onOpenChange={(open) => !open && setConfirm(null)} title={t.resumeTitle} description={t.resumeText} confirmLabel={t.resumeConfirm} loading={busy} onConfirm={() => setCancel(false)} />
    </Stack>
  );
}
