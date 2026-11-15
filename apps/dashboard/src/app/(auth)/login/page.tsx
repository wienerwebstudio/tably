'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { Alert, api, Button, Field, Input } from '@tably/ui';
import { useSubmit } from '@/lib/use-submit';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = React.useState<'credentials' | 'mfa'>('credentials');
  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const login = useSubmit(async (form: FormData) => {
    const res = await api<{ mfaRequired: boolean }>('/auth/login', { body: { email: form.get('email'), password: form.get('password') } });
    if (res.mfaRequired) setStep('mfa');
    else {
      // Zwischengespeicherte „nicht angemeldet“-Antwort verwerfen, bevor der geschützte Bereich lädt
      await mutate('/auth/me', api('/auth/me'), { revalidate: false });
      router.replace(target);
    }
  });
  const mfa = useSubmit(async (form: FormData) => {
    await api('/auth/mfa', { body: { code: String(form.get('code')).replace(/\s/g, '') } });
    await mutate('/auth/me', api('/auth/me'), { revalidate: false });
    router.replace(target);
  });

  if (step === 'mfa') {
    return (
      <form method="post" className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void mfa.submit(new FormData(e.currentTarget)))} noValidate>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bestätigungscode</h1>
          <p className="mt-2 text-sm text-muted">Gib den sechsstelligen Code aus deiner Authenticator-App ein.</p>
        </div>
        {mfa.error ? <Alert tone="danger">{mfa.error}</Alert> : null}
        <Field label="Code" error={mfa.fields.code}>
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} autoFocus required className="text-center text-lg tracking-[0.4em]" />
        </Field>
        <Button type="submit" size="lg" loading={mfa.loading}>Anmelden</Button>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setStep('credentials')}>Zurück zur Anmeldung</button>
      </form>
    );
  }

  return (
    <form method="post" className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void login.submit(new FormData(e.currentTarget)))} noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
        <p className="mt-2 text-sm text-muted">Melde dich an, um dein Treueprogramm zu verwalten.</p>
      </div>
      {params.get('reset') === '1' ? <Alert tone="success">Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.</Alert> : null}
      {login.error ? <Alert tone="danger">{login.error}</Alert> : null}
      <Field label="E-Mail-Adresse" error={login.fields.email}>
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Passwort" error={login.fields.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" loading={login.loading}>Anmelden</Button>
      <div className="flex items-center justify-between text-sm">
        <Link className="text-muted hover:text-ink" href="/forgot-password">Passwort vergessen?</Link>
        <Link className="font-medium text-brand hover:underline" href="/register">Konto erstellen</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  );
}
