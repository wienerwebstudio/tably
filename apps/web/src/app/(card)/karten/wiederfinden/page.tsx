'use client';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, api, ApiError, Button, defineCopy, Field, Input, Spinner, useCopy } from '@tapperl/ui';

const copy = defineCopy({
  de: {
    title: 'Karte wiederfinden',
    intro: 'Gib die E-Mail-Adresse ein, die du bei der Anmeldung angegeben hast. Wir schicken dir einen Link, der deine Karte auf diesem Gerät öffnet.',
    email: 'E-Mail-Adresse',
    send: 'Link senden',
    sentTitle: 'E-Mail unterwegs',
    sentText: 'Falls es eine Karte mit dieser Adresse gibt, findest du gleich einen Link in deinem Postfach. Er ist 30 Minuten gültig.',
    noOrg: 'Bitte öffne diese Seite über „Karte wiederfinden“ auf der Anmeldeseite deines Geschäfts.',
    opening: 'Karte wird geöffnet …',
    invalid: 'Dieser Link ist ungültig oder abgelaufen. Fordere einfach einen neuen an.',
    noEmailHint: 'Du hast keine E-Mail-Adresse hinterlegt? Dann hilft dir das Team im Geschäft weiter – oder du öffnest den Link aus deiner Wallet-Karte.',
  },
});

function Recover() {
  const t = useCopy(copy);
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const org = params.get('org');
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api<{ cardId: string | null }>('/public/recover/consume', { body: { token } })
      .then((res) => router.replace(res.cardId ? `/karte/${res.cardId}` : '/karten'))
      .catch(() => setError(t.invalid));
  }, [token, router, t]);

  if (token && !error) return <div className="flex flex-1 items-center justify-center"><Spinner label={t.opening} /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted">{t.intro}</p>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!org ? (
        <Alert tone="info">{t.noOrg}</Alert>
      ) : sent ? (
        <Alert tone="success" title={t.sentTitle}>{t.sentText}</Alert>
      ) : (
        <form method="post"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              await api('/public/recover', { body: { orgSlug: org, email: new FormData(e.currentTarget).get('email') } });
              setSent(true);
            } catch (err) {
              setError(err instanceof ApiError ? (err.fields.email ?? err.message) : t.invalid);
            } finally {
              setLoading(false);
            }
          }}
        >
          <Field label={t.email}>
            <Input name="email" type="email" inputMode="email" autoComplete="email" required className="h-12 text-base" />
          </Field>
          <Button type="submit" size="lg" loading={loading} className="h-14 text-base">{t.send}</Button>
          <p className="text-sm text-muted">{t.noEmailHint}</p>
        </form>
      )}
    </div>
  );
}

export default function RecoverPage() {
  return (
    <React.Suspense>
      <Recover />
    </React.Suspense>
  );
}
