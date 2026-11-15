'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ExternalLink, KeyRound, Plus } from 'lucide-react';
import type { WalletStatusDto } from '@tapperl/types';
import { Alert, api, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, CopyButton, defineCopy, Dialog, EmptyState, ErrorState, errorMessage, Field, formatDate, formatNumber, formatRelative, Input, Skeleton, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { Stack } from './shared';

const copy = defineCopy({
  de: {
    walletTitle: 'Wallet-Karten',
    walletDescription: 'Treuekarten in Apple Wallet und Google Wallet. Die Anbindung richtet der Plattformbetreiber einmalig für alle Betriebe ein.',
    configured: 'Eingerichtet',
    notConfigured: 'Nicht eingerichtet',
    appleName: 'Apple Wallet',
    appleReady: 'Deine Kunden können ihre Treuekarte auf dem iPhone zu Apple Wallet hinzufügen.',
    appleMissing: 'Nötig sind ein Apple-Developer-Konto und ein Pass-Type-ID-Zertifikat. Die Einrichtung erfolgt durch den Plattformbetreiber. Bis dahin nutzen deine Kunden die Webkarte.',
    googleName: 'Google Wallet',
    googleReady: 'Deine Kunden können ihre Treuekarte auf Android-Geräten zu Google Wallet hinzufügen.',
    googleMissing: 'Nötig ist ein Google-Wallet-Issuer-Konto mit Dienstkonto. Die Einrichtung erfolgt durch den Plattformbetreiber. Bis dahin nutzen deine Kunden die Webkarte.',
    passes: (n: string) => `${n} Karten hinzugefügt`,
    passErrors: (n: number) => (n === 1 ? 'Bei 1 Wallet-Karte ist die letzte Aktualisierung fehlgeschlagen.' : `Bei ${n} Wallet-Karten ist die letzte Aktualisierung fehlgeschlagen.`),
    planMissing: 'Wallet-Karten sind in deinem aktuellen Tarif nicht enthalten.',
    posTitle: 'Kassen-Schnittstelle',
    posDescription: 'Deine Kasse meldet Käufe an Tapperl. Bei Treuekarten mit der Buchungsart „Kassen-Ereignis“ wird ein Stempel erst vergeben, wenn ein passender Kauf gemeldet wurde.',
    posFeatureTitle: 'Im Premium-Tarif enthalten',
    posFeatureText: 'Die Kassen-Schnittstelle ist in deinem aktuellen Tarif nicht enthalten. Mit dem Premium-Tarif kannst du API-Schlüssel erstellen und deine Kasse anbinden.',
    posFeatureLink: 'Tarife ansehen',
    posNoPermission: 'API-Schlüssel können nur Inhaber:innen und Administrator:innen verwalten.',
    keysTitle: 'API-Schlüssel',
    createKey: 'Schlüssel erstellen',
    keysEmptyTitle: 'Noch kein API-Schlüssel',
    keysEmptyText: 'Erstelle einen Schlüssel für deine Kasse oder deinen Kassen-Dienstleister.',
    created: (date: string) => `erstellt am ${date}`,
    lastUsed: (when: string) => `zuletzt verwendet ${when}`,
    neverUsed: 'noch nie verwendet',
    active: 'Aktiv',
    revokedBadge: 'Widerrufen',
    revoke: 'Widerrufen',
    revokeTitle: (name: string) => `Schlüssel „${name}“ widerrufen?`,
    revokeText: 'Systeme, die diesen Schlüssel verwenden, können danach keine Kassen-Ereignisse mehr senden. Das lässt sich nicht rückgängig machen.',
    revoked: 'API-Schlüssel widerrufen.',
    createTitle: 'API-Schlüssel erstellen',
    keyName: 'Bezeichnung',
    keyNameHint: 'Zum Beispiel der Name der Kasse oder des Standorts.',
    create: 'Erstellen',
    cancel: 'Abbrechen',
    newKeyTitle: 'Dein neuer API-Schlüssel',
    newKeyWarningTitle: 'Jetzt kopieren – der Schlüssel wird nur dieses eine Mal angezeigt',
    newKeyWarning: 'Bewahre ihn sicher auf, zum Beispiel in einem Passwort-Manager. Wenn er verloren geht, widerrufe ihn und erstelle einen neuen.',
    copyKey: 'Schlüssel kopieren',
    done: 'Ich habe den Schlüssel gespeichert',
    exampleTitle: 'Beispiel: Kauf melden',
    exampleText: 'Sende nach jedem Kauf ein Ereignis. Die externalId (z. B. die Belegnummer) macht den Aufruf wiederholbar: Dasselbe Ereignis wird nie doppelt gezählt.',
    copyExample: 'Beispiel kopieren',
    docs: 'API-Dokumentation öffnen',
  },
});

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const DOCS_URL = process.env.NEXT_PUBLIC_API_DOCS_URL ?? 'http://localhost:4000/docs';
const API_BASE = DOCS_URL.replace(/\/docs\/?$/, '');
const CURL_EXAMPLE = `curl -X POST ${API_BASE}/integrations/pos/events \\
  -H "Authorization: Bearer tapperl_DEIN_SCHLUESSEL" \\
  -H "Content-Type: application/json" \\
  -d '{"externalId": "beleg-2026-000123", "amountCents": 450, "currency": "EUR"}'`;

function WalletRow({ name, configured, passes, ready, missing }: { name: string; configured: boolean; passes: number; ready: string; missing: string }) {
  const t = useCopy(copy);
  return (
    <li className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">{name}</p>
        <p className="mt-0.5 max-w-2xl text-muted">{configured ? ready : missing}</p>
        {configured ? <p className="mt-1 text-muted tabular">{t.passes(formatNumber(passes))}</p> : null}
      </div>
      <Badge tone={configured ? 'success' : 'neutral'} dot className="self-start">{configured ? t.configured : t.notConfigured}</Badge>
    </li>
  );
}

function ApiKeys() {
  const t = useCopy(copy);
  const toast = useToast();
  const keys = useSWR<ApiKeyRow[]>('/organization/api-keys');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [fresh, setFresh] = React.useState<{ name: string; key: string } | null>(null);
  const [revokeFor, setRevokeFor] = React.useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = React.useState(false);

  const create = useSubmit(async () => {
    const res = await api<{ name: string; key: string }>('/organization/api-keys', { body: { name } });
    await keys.mutate();
    setCreateOpen(false);
    setName('');
    setFresh({ name: res.name, key: res.key });
  });

  const revoke = async () => {
    if (!revokeFor) return;
    setRevoking(true);
    try {
      await api(`/organization/api-keys/${revokeFor.id}`, { method: 'DELETE' });
      await keys.mutate();
      toast.success(t.revoked);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRevoking(false);
      setRevokeFor(null);
    }
  };
  const formId = React.useId();

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 pt-5 sm:px-6">
        <h3 className="text-sm font-semibold text-ink">{t.keysTitle}</h3>
        <Button size="sm" onClick={() => (create.reset(), setCreateOpen(true))}><Plus className="size-4" aria-hidden />{t.createKey}</Button>
      </div>
      {keys.error ? (
        <ErrorState onRetry={() => void keys.mutate()} />
      ) : !keys.data ? (
        <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : keys.data.length === 0 ? (
        <EmptyState icon={<KeyRound />} title={t.keysEmptyTitle} description={t.keysEmptyText} className="py-10" />
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {keys.data.map((k) => (
            <li key={k.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  <span className="break-words">{k.name}</span>
                  <Badge tone={k.revokedAt ? 'neutral' : 'success'}>{k.revokedAt ? t.revokedBadge : t.active}</Badge>
                </p>
                <p className="text-muted">
                  <code className="font-mono text-xs">{k.prefix}…</code> · {t.created(formatDate(k.createdAt))} · {k.lastUsedAt ? t.lastUsed(formatRelative(k.lastUsedAt)) : t.neverUsed}
                </p>
              </div>
              {!k.revokedAt ? <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => setRevokeFor(k)}>{t.revoke}</Button> : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t.createTitle}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t.cancel}</Button>
            <Button type="submit" form={formId} loading={create.loading}>{t.create}</Button>
          </>
        }
      >
        <form method="post" id={formId} className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), void create.submit())} noValidate>
          {create.error ? <Alert tone="danger">{create.error}</Alert> : null}
          <Field label={t.keyName} hint={t.keyNameHint} error={create.fields.name}>
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
          </Field>
        </form>
      </Dialog>

      <Dialog open={Boolean(fresh)} onOpenChange={(open) => !open && setFresh(null)} title={t.newKeyTitle} description={fresh?.name} footer={<Button onClick={() => setFresh(null)}>{t.done}</Button>}>
        {fresh ? (
          <div className="flex flex-col gap-4">
            <Alert tone="warn" title={t.newKeyWarningTitle}>{t.newKeyWarning}</Alert>
            <code className="block break-all rounded-lg bg-sunken px-3 py-3 font-mono text-sm text-ink" data-testid="api-key-value">{fresh.key}</code>
            <div><CopyButton value={fresh.key} label={t.copyKey} /></div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog open={Boolean(revokeFor)} onOpenChange={(open) => !open && setRevokeFor(null)} title={revokeFor ? t.revokeTitle(revokeFor.name) : ''} description={t.revokeText} confirmLabel={t.revoke} danger loading={revoking} onConfirm={revoke} />
    </>
  );
}

export function IntegrationsSettings() {
  const t = useCopy(copy);
  const { me, can } = useSession();
  const wallet = useSWR<WalletStatusDto>('/wallet/status');
  const features = me.subscription?.features;
  const hasPos = Boolean(features?.posApi);

  return (
    <Stack>
      <Card>
        <CardHeader title={t.walletTitle} description={t.walletDescription} />
        {wallet.error ? (
          <ErrorState onRetry={() => void wallet.mutate()} />
        ) : !wallet.data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-line border-t border-line">
              <WalletRow name={t.appleName} configured={wallet.data.apple.configured} passes={wallet.data.apple.passes} ready={t.appleReady} missing={t.appleMissing} />
              <WalletRow name={t.googleName} configured={wallet.data.google.configured} passes={wallet.data.google.passes} ready={t.googleReady} missing={t.googleMissing} />
            </ul>
            {features && !features.walletPasses ? <div className="border-t border-line p-5 sm:px-6"><Alert tone="info">{t.planMissing}</Alert></div> : null}
            {wallet.data.passesWithErrors > 0 ? <div className="border-t border-line p-5 sm:px-6"><Alert tone="warn">{t.passErrors(wallet.data.passesWithErrors)}</Alert></div> : null}
          </>
        )}
      </Card>

      <Card>
        <CardHeader title={t.posTitle} description={t.posDescription} action={<Badge tone={hasPos ? 'success' : 'neutral'}>{hasPos ? 'Im Tarif enthalten' : 'Nicht im Tarif'}</Badge>} />
        {!hasPos ? (
          <CardBody>
            <Alert tone="info" title={t.posFeatureTitle} action={<Link href="/einstellungen?tab=abo" className="whitespace-nowrap text-sm font-semibold underline">{t.posFeatureLink}</Link>}>{t.posFeatureText}</Alert>
          </CardBody>
        ) : !can('apikeys.manage') ? (
          <CardBody><Alert tone="info">{t.posNoPermission}</Alert></CardBody>
        ) : (
          <div className="mt-5"><ApiKeys /></div>
        )}
        <div className="border-t border-line p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-ink">{t.exampleTitle}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t.exampleText}</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-sunken p-4 font-mono text-xs leading-relaxed text-ink" tabIndex={0}><code>{CURL_EXAMPLE}</code></pre>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <CopyButton value={CURL_EXAMPLE} label={t.copyExample} />
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              {t.docs}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </Card>
    </Stack>
  );
}
