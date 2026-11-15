'use client';
import * as React from 'react';
import Link from 'next/link';
import { Alert, api, Button, Field, Input } from '@tapperl/ui';
import { useSubmit } from '@/lib/use-submit';

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const form = useSubmit(async (data: FormData) => {
    await api('/auth/forgot-password', { body: { email: data.get('email') } });
    setSent(true);
  });
  return (
    <form method="post" className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void form.submit(new FormData(e.currentTarget)))} noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Passwort zurücksetzen</h1>
        <p className="mt-2 text-sm text-muted">Wir senden dir einen Link, mit dem du ein neues Passwort festlegst.</p>
      </div>
      {sent ? (
        <Alert tone="success" title="E-Mail unterwegs">Falls es ein Konto mit dieser Adresse gibt, findest du gleich einen Link in deinem Postfach. Er ist eine Stunde gültig.</Alert>
      ) : (
        <>
          {form.error ? <Alert tone="danger">{form.error}</Alert> : null}
          <Field label="E-Mail-Adresse" error={form.fields.email}>
            <Input name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Button type="submit" size="lg" loading={form.loading}>Link senden</Button>
        </>
      )}
      <Link className="text-center text-sm text-muted hover:text-ink" href="/login">Zurück zur Anmeldung</Link>
    </form>
  );
}
