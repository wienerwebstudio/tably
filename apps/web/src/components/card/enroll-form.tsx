'use client';
import * as React from 'react';
import Link from 'next/link';
import type { ProgramViewDto, TapResultDto } from '@tably/types';
import { Alert, api, ApiError, Button, Checkbox, defineCopy, Field, Input, useCopy } from '@tably/ui';

const copy = defineCopy({
  de: {
    firstName: 'Vorname',
    email: 'E-Mail-Adresse',
    emailHint: 'Damit findest du deine Karte auf einem neuen Handy wieder.',
    birthday: 'Geburtstag',
    birthdayHint: 'Für eine kleine Überraschung an deinem Geburtstag.',
    more: 'Geburtstag angeben',
    privacyBefore: 'Ich stimme der Verarbeitung meiner Angaben für diese Treuekarte zu',
    privacyLink: 'Datenschutzhinweise',
    marketing: (org: string) => `${org} darf mir gelegentlich Angebote und Neuigkeiten schicken. Jederzeit widerrufbar.`,
    submit: 'Karte anlegen',
    submitWithTap: 'Karte anlegen und Stempel sichern',
    generic: 'Das hat nicht geklappt. Bitte versuche es erneut.',
    fix: 'Bitte prüfe die markierten Felder.',
    recover: 'Karte wiederfinden',
  },
});

export interface EnrollResult {
  cardId: string;
  created: boolean;
  tap: TapResultDto | null;
}

/** Anmeldung mit so wenigen Angaben wie möglich: Pflicht ist nur der Vorname. */
export function EnrollForm({ program, tapToken, onDone }: { program: ProgramViewDto; tapToken?: string; onDone: (result: EnrollResult) => void }) {
  const t = useCopy(copy);
  const [privacy, setPrivacy] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [showBirthday, setShowBirthday] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [code, setCode] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    setFields({});
    setCode(null);
    try {
      const result = await api<EnrollResult>(`/public/programs/${program.organization.slug}/${program.slug}/enroll`, {
        body: { firstName: data.get('firstName'), email: data.get('email') || null, birthday: data.get('birthday') || null, acceptPrivacy: privacy, marketingConsent: marketing, tapToken },
      });
      onDone(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setCode(err.code);
        setError(err.code === 'validation_failed' ? t.fix : err.message);
      } else setError(t.generic);
      setLoading(false);
    }
  }

  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <Alert tone="danger">
          {error}{' '}
          {code === 'email_taken' ? <Link className="font-semibold underline" href={`/karten/wiederfinden?org=${program.organization.slug}`}>{t.recover}</Link> : null}
        </Alert>
      ) : null}
      <Field label={t.firstName} error={fields.firstName}>
        <Input name="firstName" autoComplete="given-name" autoCapitalize="words" enterKeyHint="next" required maxLength={60} className="h-12 text-base" />
      </Field>
      <Field label={t.email} optional hint={t.emailHint} error={fields.email}>
        <Input name="email" type="email" inputMode="email" autoComplete="email" enterKeyHint="done" className="h-12 text-base" />
      </Field>
      {showBirthday ? (
        <Field label={t.birthday} optional hint={t.birthdayHint} error={fields.birthday}>
          <Input name="birthday" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} className="h-12 text-base" />
        </Field>
      ) : (
        <button type="button" className="self-start text-sm font-medium text-brand hover:underline" onClick={() => setShowBirthday(true)}>
          + {t.more}
        </button>
      )}
      <div className="mt-1 flex flex-col gap-3">
        <div>
          <Checkbox
            checked={privacy}
            onChange={(e) => setPrivacy(e.currentTarget.checked)}
            required
            label={
              <>
                {t.privacyBefore} (<Link href="/datenschutz" target="_blank" className="underline">{t.privacyLink}</Link>).
              </>
            }
          />
          {fields.acceptPrivacy ? <p role="alert" className="mt-1 pl-8 text-sm text-danger">{fields.acceptPrivacy}</p> : null}
        </div>
        <Checkbox checked={marketing} onChange={(e) => setMarketing(e.currentTarget.checked)} label={t.marketing(program.organization.name)} />
      </div>
      <Button type="submit" size="lg" loading={loading} className="mt-2 h-14 text-base">
        {tapToken ? t.submitWithTap : t.submit}
      </Button>
    </form>
  );
}
