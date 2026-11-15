'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import type { CustomerDetailDto, CustomerDto, ProgramDto } from '@tably/types';
import { Alert, api, Button, defineCopy, Dialog, ErrorState, Field, Input, Select, Skeleton, Textarea, useCopy } from '@tably/ui';
import { useSubmit } from '@/lib/use-submit';
import { programStatus } from '@/lib/labels';

const copy = defineCopy({
  de: {
    createTitle: 'Kunde anlegen',
    createText: 'Der Kunde bekommt sofort eine Treuekarte. Nur der Vorname ist Pflicht.',
    editTitle: 'Stammdaten bearbeiten',
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail-Adresse',
    emailHint: 'Damit kann der Kunde seine Karte später selbst wiederfinden.',
    phone: 'Telefon',
    birthday: 'Geburtstag',
    note: 'Interne Notiz',
    noteHint: 'Nur für dein Team sichtbar.',
    program: 'Treuekarte',
    cancel: 'Abbrechen',
    create: 'Kunde anlegen',
    save: 'Speichern',
    noProgramsTitle: 'Noch keine Treuekarte vorhanden',
    noProgramsText: 'Lege zuerst eine Treuekarte an, dann kannst du Kunden hinzufügen.',
    noProgramsLink: 'Zu den Treuekarten',
    programsError: 'Die Treuekarten konnten nicht geladen werden.',
    firstNameRequired: 'Bitte gib einen Vornamen ein.',
    emailInvalid: 'Bitte gib eine gültige E-Mail-Adresse ein (z. B. name@beispiel.at).',
  },
});

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthday: string;
  note: string;
  programId: string;
}

function FormBody({ customer, formId, onSaved, onLoading, onReady }: { customer?: CustomerDto; formId: string; onSaved: (detail: CustomerDetailDto) => void; onLoading: (loading: boolean) => void; onReady: (ready: boolean) => void }) {
  const t = useCopy(copy);
  const isEdit = Boolean(customer);
  const programs = useSWR<ProgramDto[]>(isEdit ? null : '/programs');
  const usable = React.useMemo(() => (programs.data ?? []).filter((p) => p.status !== 'ARCHIVED'), [programs.data]);
  const [form, setForm] = React.useState<FormState>({
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    birthday: customer?.birthday ? customer.birthday.slice(0, 10) : '',
    note: customer?.note ?? '',
    programId: '',
  });
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const programId = form.programId || usable.find((p) => p.status === 'PUBLISHED')?.id || usable[0]?.id || '';
  const ready = isEdit || usable.length > 0;
  React.useEffect(() => onReady(ready), [ready, onReady]);

  const { submit, loading, error, fields } = useSubmit(async () => {
    const base = { firstName: form.firstName, lastName: form.lastName, email: form.email.trim() ? form.email.trim() : null, phone: form.phone, birthday: form.birthday || null };
    const detail = customer
      ? await api<CustomerDetailDto>(`/customers/${customer.id}`, { method: 'PATCH', body: { ...base, note: form.note } })
      : await api<CustomerDetailDto>('/customers', { body: { ...base, programId } });
    onSaved(detail);
  });
  React.useEffect(() => onLoading(loading), [loading, onLoading]);

  if (!isEdit && programs.error) return <ErrorState description={t.programsError} onRetry={() => void programs.mutate()} />;
  if (!isEdit && !programs.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }
  if (!ready) {
    return (
      <Alert tone="info" title={t.noProgramsTitle} action={<Link href="/karten" className="whitespace-nowrap text-sm font-semibold underline">{t.noProgramsLink}</Link>}>
        {t.noProgramsText}
      </Alert>
    );
  }

  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const nameError = form.firstName.trim() ? null : t.firstNameRequired;
        const mailError = form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) ? t.emailInvalid : null;
        setLocalError(nameError);
        setEmailError(mailError);
        if (nameError || mailError) return;
        void submit();
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.firstName} error={localError ?? fields.firstName}>
          <Input value={form.firstName} onChange={set('firstName')} autoComplete="off" maxLength={60} required autoFocus />
        </Field>
        <Field label={t.lastName} error={fields.lastName} optional>
          <Input value={form.lastName} onChange={set('lastName')} autoComplete="off" maxLength={60} />
        </Field>
      </div>
      <Field label={t.email} error={emailError ?? fields.email} hint={t.emailHint} optional>
        <Input type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="off" maxLength={254} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.phone} error={fields.phone} optional>
          <Input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="off" maxLength={40} />
        </Field>
        <Field label={t.birthday} error={fields.birthday} optional>
          <Input type="date" value={form.birthday} onChange={set('birthday')} max={new Date().toISOString().slice(0, 10)} />
        </Field>
      </div>
      {isEdit ? (
        <Field label={t.note} error={fields.note} hint={t.noteHint} optional>
          <Textarea value={form.note} onChange={set('note')} maxLength={500} />
        </Field>
      ) : (
        <Field label={t.program} error={fields.programId}>
          <Select value={programId} onChange={set('programId')}>
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status !== 'PUBLISHED' ? ` (${programStatus[p.status].label})` : ''}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </form>
  );
}

/** Dialog zum Anlegen (ohne `customer`) oder Bearbeiten eines Kunden. */
export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; customer?: CustomerDto; onSaved: (detail: CustomerDetailDto) => void }) {
  const t = useCopy(copy);
  const formId = React.useId();
  const [loading, setLoading] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? t.editTitle : t.createTitle}
      description={customer ? undefined : t.createText}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} loading={loading} disabled={!ready}>
            {customer ? t.save : t.create}
          </Button>
        </>
      }
    >
      {open ? <FormBody customer={customer} formId={formId} onSaved={onSaved} onLoading={setLoading} onReady={setReady} /> : null}
    </Dialog>
  );
}
