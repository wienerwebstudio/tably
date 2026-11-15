'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, api, Button, Field, Input } from '@tably/ui';
import { useSubmit } from '@/lib/use-submit';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const form = useSubmit(async (data: FormData) => {
    await api('/auth/reset-password', { body: { token, password: data.get('password') } });
    router.replace('/login?reset=1');
  });
  if (!token) return <Alert tone="danger" title="Link unvollständig">Bitte öffne den Link aus der E-Mail erneut oder fordere einen neuen an.</Alert>;
  return (
    <form method="post" className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void form.submit(new FormData(e.currentTarget)))} noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Neues Passwort</h1>
        <p className="mt-2 text-sm text-muted">Danach wirst du auf allen Geräten abgemeldet.</p>
      </div>
      {form.error ? <Alert tone="danger">{form.error}</Alert> : null}
      <Field label="Neues Passwort" error={form.fields.password} hint="Mindestens 10 Zeichen, mit Buchstaben und Ziffern.">
        <Input name="password" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Button type="submit" size="lg" loading={form.loading}>Passwort speichern</Button>
      <Link className="text-center text-sm text-muted hover:text-ink" href="/forgot-password">Neuen Link anfordern</Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetForm />
    </React.Suspense>
  );
}
