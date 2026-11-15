'use client';
import * as React from 'react';
import useSWR from 'swr';
import QRCode from 'qrcode';
import { Monitor, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { Alert, api, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, CopyButton, defineCopy, Dialog, ErrorState, errorMessage, Field, formatDateTime, formatRelative, Input, Skeleton, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { Stack } from './shared';

const copy = defineCopy({
  de: {
    profileTitle: 'Dein Profil',
    profileDescription: 'So erscheinst du im Team und im Protokoll.',
    name: 'Name',
    emailLabel: 'E-Mail-Adresse',
    emailHint: 'Die E-Mail-Adresse kann derzeit nicht geändert werden.',
    saveName: 'Namen speichern',
    nameSaved: 'Name gespeichert.',
    passwordTitle: 'Passwort',
    passwordDescription: 'Nach der Änderung werden alle anderen Geräte abgemeldet.',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    newPasswordHint: 'Mindestens 10 Zeichen, mit Buchstaben und Ziffern.',
    repeatPassword: 'Neues Passwort wiederholen',
    passwordMismatch: 'Die Passwörter stimmen nicht überein.',
    savePassword: 'Passwort ändern',
    passwordSaved: 'Passwort geändert.',
    mfaTitle: 'Zwei-Faktor-Anmeldung',
    mfaDescription: 'Zusätzlich zum Passwort fragst du bei der Anmeldung einen Code aus einer Authenticator-App ab.',
    mfaOn: 'Aktiv',
    mfaOff: 'Nicht aktiv',
    mfaOnText: 'Dein Konto ist mit einem zweiten Faktor geschützt.',
    mfaOffText: 'Wir empfehlen dir, die Zwei-Faktor-Anmeldung einzurichten – besonders, wenn du Zugriff auf Kundendaten und Abrechnung hast.',
    mfaSetup: 'Jetzt einrichten',
    mfaDisable: 'Deaktivieren',
    setupTitle: 'Zwei-Faktor-Anmeldung einrichten',
    setupStep1: '1. Scanne den QR-Code mit deiner Authenticator-App (z. B. Google Authenticator, 1Password, Authy).',
    setupManual: 'Oder gib diesen Schlüssel von Hand ein:',
    setupStep2: '2. Gib den sechsstelligen Code aus der App ein.',
    qrAlt: 'QR-Code zum Einrichten der Authenticator-App',
    copySecret: 'Schlüssel kopieren',
    code: 'Code',
    activate: 'Aktivieren',
    cancel: 'Abbrechen',
    mfaEnabled: 'Zwei-Faktor-Anmeldung ist jetzt aktiv.',
    disableTitle: 'Zwei-Faktor-Anmeldung deaktivieren',
    disableText: 'Bestätige mit einem aktuellen Code aus deiner Authenticator-App. Dein Konto ist danach nur noch durch das Passwort geschützt.',
    mfaDisabled: 'Zwei-Faktor-Anmeldung deaktiviert.',
    setupError: 'Die Einrichtung konnte nicht gestartet werden.',
    sessionsTitle: 'Aktive Sitzungen',
    sessionsDescription: 'Geräte, auf denen du gerade angemeldet bist.',
    thisDevice: 'Dieses Gerät',
    lastSeen: (when: string) => `zuletzt aktiv ${when}`,
    signedIn: (when: string) => `angemeldet am ${when}`,
    unknownDevice: 'Unbekanntes Gerät',
    unknownIp: 'IP unbekannt',
    revokeOthers: 'Alle anderen abmelden',
    revokeTitle: 'Alle anderen Geräte abmelden?',
    revokeText: 'Auf allen anderen Geräten musst du dich danach neu anmelden. Diese Sitzung bleibt bestehen.',
    revokeConfirm: 'Abmelden',
    revoked: 'Alle anderen Sitzungen wurden beendet.',
    onlyThis: 'Du bist nur auf diesem Gerät angemeldet.',
  },
});

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  current: boolean;
}

/** Grobe, lesbare Beschreibung aus dem User-Agent (Browser · System). */
function describeAgent(ua: string | null): { label: string | null; mobile: boolean } {
  if (!ua) return { label: null, mobile: false };
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl\//.test(ua) ? 'curl' : null;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  const label = [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 60);
  return { label, mobile: /iPhone|Android.+Mobile/.test(ua) };
}

const cleanCode = (value: FormDataEntryValue | null) => String(value ?? '').replace(/\s/g, '');

function CodeField({ error, label }: { error?: string; label: string }) {
  return (
    <Field label={label} error={error}>
      <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} required className="max-w-44 text-center text-lg tracking-[0.3em]" />
    </Field>
  );
}

function SetupDialog({ onOpenChange, onDone }: { onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [setup, setSetup] = React.useState<{ secret: string; qr: string } | null>(null);
  const [setupError, setSetupError] = React.useState<string | null>(null);
  const started = React.useRef(false);

  const start = React.useCallback(async () => {
    setSetupError(null);
    try {
      const res = await api<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' });
      const qr = await QRCode.toDataURL(res.otpauthUrl, { margin: 2, width: 220, errorCorrectionLevel: 'M' });
      setSetup({ secret: res.secret, qr });
    } catch (err) {
      setSetupError(errorMessage(err) || t.setupError);
    }
  }, [t.setupError]);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const enable = useSubmit(async (form: FormData) => {
    await api('/auth/2fa/enable', { body: { code: cleanCode(form.get('code')) } });
    await onDone();
    toast.success(t.mfaEnabled);
    onOpenChange(false);
  });
  const formId = React.useId();

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t.setupTitle}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button type="submit" form={formId} loading={enable.loading} disabled={!setup}>{t.activate}</Button>
        </>
      }
    >
      {setupError ? (
        <ErrorState description={setupError} onRetry={() => void start()} />
      ) : !setup ? (
        <div className="flex flex-col items-center gap-4"><Skeleton className="size-[220px] rounded-xl" /><Skeleton className="h-10 w-full rounded-lg" /></div>
      ) : (
        <form method="post" id={formId} className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), void enable.submit(new FormData(e.currentTarget)))} noValidate>
          <p className="text-sm text-ink">{t.setupStep1}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt={t.qrAlt} width={220} height={220} className="mx-auto rounded-xl border border-line bg-white" />
          <div>
            <p className="text-sm text-muted">{t.setupManual}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-sm text-ink" data-testid="totp-secret">{setup.secret}</code>
              <CopyButton value={setup.secret} label={t.copySecret} />
            </div>
          </div>
          <p className="text-sm text-ink">{t.setupStep2}</p>
          {enable.error ? <Alert tone="danger">{enable.error}</Alert> : null}
          <CodeField label={t.code} error={enable.fields.code} />
        </form>
      )}
    </Dialog>
  );
}

function DisableDialog({ onOpenChange, onDone }: { onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const disable = useSubmit(async (form: FormData) => {
    await api('/auth/2fa/disable', { body: { code: cleanCode(form.get('code')) } });
    await onDone();
    toast.success(t.mfaDisabled);
    onOpenChange(false);
  });
  const formId = React.useId();
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t.disableTitle}
      description={t.disableText}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button type="submit" form={formId} variant="danger" loading={disable.loading}>{t.mfaDisable}</Button>
        </>
      }
    >
      <form method="post" id={formId} className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), void disable.submit(new FormData(e.currentTarget)))} noValidate>
        {disable.error ? <Alert tone="danger">{disable.error}</Alert> : null}
        <CodeField label={t.code} error={disable.fields.code} />
      </form>
    </Dialog>
  );
}

export function SecuritySettings() {
  const t = useCopy(copy);
  const { me, refresh } = useSession();
  const toast = useToast();
  const sessions = useSWR<SessionRow[]>('/auth/sessions');
  const [name, setName] = React.useState(me.user.name);
  const [mfaDialog, setMfaDialog] = React.useState<'setup' | 'disable' | null>(null);
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [mismatch, setMismatch] = React.useState(false);
  const passwordForm = React.useRef<HTMLFormElement>(null);

  const saveName = useSubmit(async () => {
    await api('/auth/me', { method: 'PATCH', body: { name } });
    await refresh();
    toast.success(t.nameSaved);
  });

  const savePassword = useSubmit(async (form: FormData) => {
    await api('/auth/change-password', { body: { currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') } });
    passwordForm.current?.reset();
    await sessions.mutate();
    toast.success(t.passwordSaved);
  });

  const revokeOthers = async () => {
    setRevoking(true);
    try {
      await api('/auth/sessions/revoke-others', { method: 'POST' });
      await sessions.mutate();
      toast.success(t.revoked);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRevoking(false);
      setRevokeOpen(false);
    }
  };

  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <Stack>
      <Card>
        <CardHeader title={t.profileTitle} description={t.profileDescription} />
        <CardBody>
          <form method="post" className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), void saveName.submit())} noValidate>
            {saveName.error ? <Alert tone="danger" className="sm:col-span-2">{saveName.error}</Alert> : null}
            <Field label={t.name} error={saveName.fields.name}>
              <Input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" />
            </Field>
            <Field label={t.emailLabel} hint={t.emailHint}>
              <Input value={me.user.email} disabled readOnly />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={saveName.loading} disabled={name.trim() === me.user.name || name.trim().length < 2}>{t.saveName}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.passwordTitle} description={t.passwordDescription} />
        <CardBody>
          <form method="post"
            ref={passwordForm}
            className="flex max-w-md flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (form.get('newPassword') !== form.get('repeatPassword')) return setMismatch(true);
              setMismatch(false);
              void savePassword.submit(form);
            }}
            noValidate
          >
            {savePassword.error ? <Alert tone="danger">{savePassword.error}</Alert> : null}
            <Field label={t.currentPassword} error={savePassword.fields.currentPassword}>
              <Input name="currentPassword" type="password" autoComplete="current-password" required />
            </Field>
            <Field label={t.newPassword} error={savePassword.fields.newPassword} hint={t.newPasswordHint}>
              <Input name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
            </Field>
            <Field label={t.repeatPassword} error={mismatch ? t.passwordMismatch : undefined}>
              <Input name="repeatPassword" type="password" autoComplete="new-password" required onChange={() => mismatch && setMismatch(false)} />
            </Field>
            <div>
              <Button type="submit" loading={savePassword.loading}>{t.savePassword}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.mfaTitle} description={t.mfaDescription} action={me.user.totpEnabled ? <Badge tone="success" dot>{t.mfaOn}</Badge> : <Badge dot>{t.mfaOff}</Badge>} />
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-muted">
            {me.user.totpEnabled ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <ShieldOff className="mt-0.5 size-5 shrink-0" aria-hidden />}
            <span className="max-w-xl">{me.user.totpEnabled ? t.mfaOnText : t.mfaOffText}</span>
          </p>
          {me.user.totpEnabled ? (
            <Button variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => setMfaDialog('disable')}>{t.mfaDisable}</Button>
          ) : (
            <Button className="shrink-0 self-start sm:self-auto" onClick={() => setMfaDialog('setup')}>{t.mfaSetup}</Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.sessionsTitle} description={t.sessionsDescription} action={others > 0 ? <Button variant="outline" size="sm" onClick={() => setRevokeOpen(true)}>{t.revokeOthers}</Button> : undefined} />
        {sessions.error ? (
          <ErrorState onRetry={() => void sessions.mutate()} />
        ) : !sessions.data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {sessions.data.map((s) => {
                const agent = describeAgent(s.userAgent);
                const Icon = agent.mobile ? Smartphone : Monitor;
                return (
                  <li key={s.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                    <Icon className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        <span className="break-words">{agent.label ?? t.unknownDevice}</span>
                        {s.current ? <Badge tone="brand">{t.thisDevice}</Badge> : null}
                      </p>
                      <p className="text-muted">
                        {s.ip ?? t.unknownIp} · {s.lastSeenAt ? t.lastSeen(formatRelative(s.lastSeenAt)) : t.signedIn(formatDateTime(s.createdAt))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {others === 0 ? <p className="border-t border-line px-5 py-3.5 text-sm text-muted sm:px-6">{t.onlyThis}</p> : null}
          </>
        )}
      </Card>

      {mfaDialog === 'setup' ? <SetupDialog onOpenChange={(open) => !open && setMfaDialog(null)} onDone={refresh} /> : null}
      {mfaDialog === 'disable' ? <DisableDialog onOpenChange={(open) => !open && setMfaDialog(null)} onDone={refresh} /> : null}
      <ConfirmDialog open={revokeOpen} onOpenChange={setRevokeOpen} title={t.revokeTitle} description={t.revokeText} confirmLabel={t.revokeConfirm} loading={revoking} onConfirm={revokeOthers} />
    </Stack>
  );
}
