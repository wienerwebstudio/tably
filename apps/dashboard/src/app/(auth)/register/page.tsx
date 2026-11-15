'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { TRIAL_DAYS } from '@tapperl/config';
import { Alert, api, Button, Checkbox, Field, Input } from '@tapperl/ui';
import { useSubmit } from '@/lib/use-submit';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

export default function RegisterPage() {
  const router = useRouter();
  const [accept, setAccept] = React.useState(false);
  const form = useSubmit(async (data: FormData) => {
    await api('/auth/register', {
      body: { name: data.get('name'), email: data.get('email'), password: data.get('password'), organizationName: data.get('organizationName'), acceptTerms: accept },
    });
    await mutate('/auth/me', api('/auth/me'), { revalidate: false });
    router.replace('/onboarding');
  });
  return (
    <form method="post" className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void form.submit(new FormData(e.currentTarget)))} noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{TRIAL_DAYS} Tage kostenlos testen</h1>
        <p className="mt-2 text-sm text-muted">Ohne Zahlungsdaten. In wenigen Minuten steht deine erste digitale Treuekarte.</p>
      </div>
      {form.error ? <Alert tone="danger">{form.error}</Alert> : null}
      <Field label="Name deines Betriebs" error={form.fields.organizationName}>
        <Input name="organizationName" autoComplete="organization" placeholder="z. B. Café Morgenrot" required autoFocus />
      </Field>
      <Field label="Dein Name" error={form.fields.name}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="E-Mail-Adresse" error={form.fields.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Passwort" error={form.fields.password} hint="Mindestens 10 Zeichen, mit Buchstaben und Ziffern.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <div>
        <Checkbox
          checked={accept}
          onChange={(e) => setAccept(e.currentTarget.checked)}
          label={
            <>
              Ich akzeptiere die <a className="underline" href={`${WEB_URL}/agb`} target="_blank" rel="noreferrer">Nutzungsbedingungen</a> und habe die{' '}
              <a className="underline" href={`${WEB_URL}/datenschutz`} target="_blank" rel="noreferrer">Datenschutzhinweise</a> gelesen.
            </>
          }
        />
        {form.fields.acceptTerms ? <p role="alert" className="mt-1.5 text-sm text-danger">{form.fields.acceptTerms}</p> : null}
      </div>
      <Button type="submit" size="lg" loading={form.loading}>Konto erstellen</Button>
      <p className="text-center text-sm text-muted">
        Schon registriert? <Link className="font-medium text-brand hover:underline" href="/login">Anmelden</Link>
      </p>
    </form>
  );
}
