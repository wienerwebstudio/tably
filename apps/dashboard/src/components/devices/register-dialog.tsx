'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { FlaskConical, Nfc } from 'lucide-react';
import type { DeviceDetailDto, LocationDto, ProgramDto } from '@tably/types';
import { Alert, api, Button, cn, defineCopy, Dialog, Field, Input, Select, useCopy } from '@tably/ui';
import { useSubmit } from '@/lib/use-submit';

const copy = defineCopy({
  de: {
    title: 'Stempel registrieren',
    description: 'Lege den Stempel hier an. Danach zeigen wir dir, wie er in Betrieb geht.',
    name: 'Name',
    nameHint: 'So erkennst du den Stempel wieder, z. B. „Theke links“.',
    namePlaceholder: 'z. B. Theke',
    nameRequired: 'Bitte gib dem Stempel einen Namen.',
    kind: 'Art des Stempels',
    physicalTitle: 'NFC-Stempel',
    physicalText: 'Ein echter Chip (NTAG 424 DNA) zum Aufstellen oder Aufkleben. Er muss einmalig mit einem NFC-Schreibgerät eingerichtet werden.',
    simulatedTitle: 'Simulierter Stempel',
    simulatedBadge: 'Simulation – nur für Tests',
    simulatedText: 'Kein echter Chip. Du erzeugst Taps per Knopfdruck im Dashboard, um Abläufe auszuprobieren.',
    location: 'Standort',
    noLocation: 'Kein Standort',
    program: 'Treueprogramm',
    noProgram: 'Noch kein Programm zuordnen',
    programHint: 'Für dieses Programm vergibt der Stempel seine Stempel.',
    cancel: 'Abbrechen',
    submit: 'Stempel registrieren',
    limitTitle: 'Dein Tarif erlaubt keine weiteren Stempel',
    limitLink: 'Tarif ansehen und wechseln',
    simulatorDisabled: 'Der Simulationsmodus ist auf diesem System nicht aktiviert. Bitte wähle den NFC-Stempel.',
  },
});

type Kind = 'PASSIVE_NTAG424' | 'SIMULATED';

/** Dialog zum Anlegen eines Stempels. `allowSimulated` = false blendet die Simulation aus. */
export function RegisterDeviceDialog({ open, onOpenChange, allowSimulated, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; allowSimulated: boolean; onCreated: (detail: DeviceDetailDto) => void }) {
  const t = useCopy(copy);
  const locations = useSWR<LocationDto[]>(open ? '/organization/locations' : null);
  const programs = useSWR<ProgramDto[]>(open ? '/programs' : null);
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<Kind>('PASSIVE_NTAG424');
  const [locationId, setLocationId] = React.useState('');
  const [programId, setProgramId] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const form = useSubmit((body: { name: string; kind: Kind; locationId: string | null; programId: string | null }) => api<DeviceDetailDto>('/devices', { body }));

  React.useEffect(() => {
    if (open) {
      setName('');
      setKind('PASSIVE_NTAG424');
      setLocationId('');
      setProgramId('');
      setNameError(null);
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeLocations = (locations.data ?? []).filter((l) => l.isActive);
  const usablePrograms = (programs.data ?? []).filter((p) => p.status !== 'ARCHIVED');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t.nameRequired);
      return;
    }
    setNameError(null);
    const created = await form.submit({ name: name.trim(), kind, locationId: locationId || null, programId: programId || null });
    if (created) onCreated(created);
  }

  const kinds: Array<{ value: Kind; title: string; text: string; icon: React.ReactNode; badge?: string }> = [
    { value: 'PASSIVE_NTAG424', title: t.physicalTitle, text: t.physicalText, icon: <Nfc className="size-5" aria-hidden /> },
    ...(allowSimulated ? [{ value: 'SIMULATED' as const, title: t.simulatedTitle, text: t.simulatedText, icon: <FlaskConical className="size-5" aria-hidden />, badge: t.simulatedBadge }] : []),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button type="submit" form="register-device-form" loading={form.loading}>
            {t.submit}
          </Button>
        </>
      }
    >
      <form id="register-device-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {form.code === 'limit_reached' ? (
          <Alert tone="warn" title={t.limitTitle}>
            <p>{form.error}</p>
            <Link href="/einstellungen?tab=abo" className="mt-1 inline-block font-medium text-brand underline">
              {t.limitLink}
            </Link>
          </Alert>
        ) : form.error && Object.keys(form.fields).length === 0 ? (
          <Alert tone="danger">{form.code === 'simulator_disabled' ? t.simulatorDisabled : form.error}</Alert>
        ) : null}

        <Field label={t.name} hint={t.nameHint} error={nameError ?? form.fields.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t.namePlaceholder} autoComplete="off" required />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.kind}</legend>
          <div className="grid gap-2">
            {kinds.map((k) => (
              <label
                key={k.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30',
                  kind === k.value ? 'border-brand bg-brand-soft' : 'border-line-strong hover:bg-sunken',
                )}
              >
                <input type="radio" name="device-kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
                <span className={cn('mt-0.5 shrink-0', kind === k.value ? 'text-brand' : 'text-muted')}>{k.icon}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
                    {k.title}
                    {k.badge ? <span className="rounded-full bg-honey-soft px-2 py-0.5 text-xs font-medium text-honey">{k.badge}</span> : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{k.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.location} optional error={form.fields.locationId}>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!locations.data}>
              <option value="">{t.noLocation}</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.program} optional error={form.fields.programId}>
            <Select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!programs.data}>
              <option value="">{t.noProgram}</option>
              {usablePrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="-mt-3 text-sm text-muted">{t.programHint}</p>
      </form>
    </Dialog>
  );
}
