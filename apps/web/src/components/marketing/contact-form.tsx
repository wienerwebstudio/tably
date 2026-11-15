'use client';
import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, api, ApiError, Button, Field, Input, Select, Textarea } from '@tably/ui';
import { CONTACT_TOPICS } from './site';


type Fields = 'name' | 'email' | 'company' | 'topic' | 'message';
const FIELD_HINTS = {
  name: 'Bitte gib deinen Namen an (mindestens zwei Zeichen).',
  email: 'Bitte gib eine gültige E-Mail-Adresse an.',
  company: 'Bitte kürze den Namen des Betriebs (höchstens 80 Zeichen).',
  topic: 'Bitte wähle ein Thema aus der Liste.',
  message: 'Bitte schreib uns mindestens zehn Zeichen (höchstens 3000).',
} as const;
const EMPTY: Record<Fields, string> = { name: '', email: '', company: '', topic: '', message: '' };

export function ContactForm({ initialTopic = '' }: { initialTopic?: string }) {
  const [values, setValues] = React.useState<Record<Fields, string>>({ ...EMPTY, topic: initialTopic });
  const [website, setWebsite] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const successRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  const set = (key: Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => rest);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFormError(null);
    setErrors({});
    try {
      await api('/public/contact', {
        body: {
          name: values.name,
          email: values.email,
          company: values.company || undefined,
          topic: values.topic || undefined,
          message: values.message,
          website,
        },
      });
      setSent(true);
      setValues(EMPTY);
    } catch (err) {
      if (err instanceof ApiError) {
        // Die API liefert teils englische Standardtexte – für die bekannten Felder zeigen wir klare deutsche Hinweise.
        const fields: Record<string, string> = { ...(err.fields ?? {}) };
        for (const key of Object.keys(FIELD_HINTS) as Array<keyof typeof FIELD_HINTS>) {
          if (fields[key] && /too (small|big)|invalid|expected|required/i.test(fields[key])) fields[key] = FIELD_HINTS[key];
        }
        setErrors(fields);
        const known = (Object.keys(EMPTY) as Fields[]).filter((k) => fields[k]);
        if (known.length > 0) {
          setFormError(null);
          // Fokus auf das erste fehlerhafte Feld
          requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        } else {
          setFormError(err.status === 429 ? 'Zu viele Anfragen in kurzer Zeit. Bitte versuche es in ein paar Minuten erneut.' : err.message);
        }
      } else {
        setFormError('Unerwarteter Fehler. Bitte versuche es erneut.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card outline-none sm:p-12">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h2 className="mt-6 font-display text-3xl text-ink">Danke, deine Nachricht ist angekommen.</h2>
        <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-muted">Wir melden uns per E-Mail bei dir. Einen festen Zeitrahmen versprechen wir nicht – aber jede Nachricht wird gelesen.</p>
        <Button variant="outline" className="mt-8" onClick={() => setSent(false)}>
          Weitere Nachricht schreiben
        </Button>
      </div>
    );
  }

  return (
    <form method="post" ref={formRef} onSubmit={onSubmit} noValidate className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-9" aria-labelledby="kontakt-formular-titel">
      <h2 id="kontakt-formular-titel" className="font-display text-2xl text-ink">
        Nachricht schreiben
      </h2>
      <p className="mt-1.5 text-sm text-muted">Name, E-Mail-Adresse und Nachricht brauchen wir, der Rest ist freiwillig.</p>

      {formError ? (
        <Alert tone="danger" title="Das hat nicht geklappt" className="mt-6">
          {formError}
        </Alert>
      ) : null}

      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input name="name" autoComplete="name" value={values.name} onChange={set('name')} maxLength={80} required />
        </Field>
        <Field label="E-Mail-Adresse" error={errors.email}>
          <Input name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set('email')} required />
        </Field>
        <Field label="Betrieb" optional error={errors.company}>
          <Input name="company" autoComplete="organization" value={values.company} onChange={set('company')} maxLength={80} />
        </Field>
        <Field label="Thema" optional error={errors.topic}>
          <Select name="topic" value={values.topic} onChange={set('topic')}>
            <option value="">Bitte wählen</option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.key} value={t.value}>
                {t.value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nachricht" error={errors.message} hint="Mindestens zehn Zeichen." className="sm:col-span-2">
          <Textarea name="message" rows={6} value={values.message} onChange={set('message')} maxLength={3000} required className="min-h-36" />
        </Field>
      </div>

      {/* Honeypot: für Menschen unsichtbar und nicht fokussierbar */}
      <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
        <label>
          Website (bitte leer lassen)
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-relaxed text-muted">
          Wir verwenden deine Angaben ausschließlich, um deine Anfrage zu beantworten. Mehr dazu in den{' '}
          <a href="/datenschutz" className="font-medium text-brand underline underline-offset-2">
            Datenschutzhinweisen
          </a>
          .
        </p>
        <Button type="submit" size="lg" loading={loading} className="shrink-0 rounded-xl">
          {loading ? 'Wird gesendet …' : 'Nachricht senden'}
        </Button>
      </div>
    </form>
  );
}
