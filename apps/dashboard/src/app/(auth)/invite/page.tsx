'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import type { Role } from '@tably/types';
import { Alert, api, ApiError, Button, buttonClass, Field, Input, Skeleton } from '@tably/ui';
import { roleLabel } from '@/lib/labels';
import { useSubmit } from '@/lib/use-submit';

interface InvitationInfo {
  organizationName: string;
  email: string;
  role: Role;
  userExists: boolean;
}

function Invite() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const { data, error, isLoading } = useSWR<InvitationInfo, ApiError>(token ? `/auth/invitations/${token}` : null);
  const [joined, setJoined] = React.useState(false);
  const form = useSubmit(async (formData: FormData | null) => {
    const res = await api<{ needsLogin: boolean }>('/auth/invitations/accept', { body: { token, name: formData?.get('name') ?? undefined, password: formData?.get('password') ?? undefined } });
    if (res.needsLogin) setJoined(true);
    else {
      await mutate('/auth/me', api('/auth/me'), { revalidate: false });
      router.replace('/');
    }
  });

  if (!token || error) return <Alert tone="danger" title="Einladung ungültig">Diese Einladung ist abgelaufen oder wurde zurückgezogen. Bitte lass dir eine neue schicken.</Alert>;
  if (isLoading || !data) return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /></div>;
  if (joined) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success" title="Du bist dabei">Du gehörst jetzt zum Team von {data.organizationName}. Melde dich mit deinem bestehenden Konto an.</Alert>
        <Link href="/login" className={buttonClass({ size: 'lg' })}>Zur Anmeldung</Link>
      </div>
    );
  }
  return (
    <form method="post" className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void form.submit(data.userExists ? null : new FormData(e.currentTarget)))} noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Einladung zu {data.organizationName}</h1>
        <p className="mt-2 text-sm text-muted">
          Du wurdest als <strong className="text-ink">{roleLabel[data.role]}</strong> eingeladen ({data.email}).
        </p>
      </div>
      {form.error ? <Alert tone="danger">{form.error}</Alert> : null}
      {data.userExists ? (
        <p className="text-sm text-muted">Für diese Adresse gibt es bereits ein Tably-Konto. Mit einem Klick trittst du dem Team bei.</p>
      ) : (
        <>
          <Field label="Dein Name" error={form.fields.name}>
            <Input name="name" autoComplete="name" required autoFocus />
          </Field>
          <Field label="Passwort festlegen" error={form.fields.password} hint="Mindestens 10 Zeichen, mit Buchstaben und Ziffern.">
            <Input name="password" type="password" autoComplete="new-password" required />
          </Field>
        </>
      )}
      <Button type="submit" size="lg" loading={form.loading}>Einladung annehmen</Button>
    </form>
  );
}

export default function InvitePage() {
  return (
    <React.Suspense>
      <Invite />
    </React.Suspense>
  );
}
