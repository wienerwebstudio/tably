'use client';
import * as React from 'react';
import useSWR from 'swr';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { INDUSTRIES } from '@tably/config';
import type { OrganizationDto } from '@tably/types';
import { Alert, api, ApiError, Button, Card, CardBody, CardHeader, ConfirmDialog, defineCopy, ErrorState, errorMessage, Field, Input, Select, Skeleton, useCopy, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { industryLabel } from '@/lib/labels';
import { Stack } from './shared';

const copy = defineCopy({
  de: {
    readOnly: 'Du kannst die Betriebsdaten ansehen, aber nicht ändern. Dafür braucht es die Rolle Inhaber:in oder Administrator:in.',
    baseTitle: 'Betriebsdaten',
    baseDescription: 'So erscheint dein Betrieb auf Treuekarten und in E-Mails an deine Kunden.',
    name: 'Firmenname',
    industry: 'Branche',
    contactTitle: 'Kontakt und Adresse',
    email: 'E-Mail-Adresse',
    phone: 'Telefon',
    website: 'Website',
    address: 'Straße und Hausnummer',
    postalCode: 'PLZ',
    city: 'Ort',
    country: 'Land',
    regionTitle: 'Region',
    timezone: 'Zeitzone',
    timezoneHint: 'Bestimmt Tagesgrenzen für Limits und Auswertungen.',
    currency: 'Währung',
    brandTitle: 'Erscheinungsbild',
    brandDescription: 'Markenfarbe und Logo werden als Vorgabe für neue Treuekarten verwendet.',
    brandColor: 'Markenfarbe',
    brandColorPicker: 'Markenfarbe auswählen',
    brandColorHint: 'Hex-Wert, zum Beispiel #1F3A2E',
    brandColorInvalid: 'Bitte gib die Farbe als #RRGGBB an.',
    save: 'Änderungen speichern',
    saved: 'Betriebsdaten gespeichert.',
    logo: 'Logo',
    logoHint: 'PNG oder JPEG, höchstens 512 KB. Am besten quadratisch.',
    logoNone: 'Noch kein Logo hochgeladen',
    logoAlt: 'Logo deines Betriebs',
    logoUpload: 'Logo hochladen',
    logoReplace: 'Logo ersetzen',
    logoRemove: 'Entfernen',
    logoUploaded: 'Logo gespeichert.',
    logoRemoved: 'Logo entfernt.',
    logoWrongType: 'Bitte wähle ein PNG- oder JPEG-Bild.',
    logoTooLarge: 'Die Datei ist größer als 512 KB. Bitte verkleinere das Bild.',
    logoReadError: 'Die Datei konnte nicht gelesen werden.',
    logoRemoveTitle: 'Logo entfernen?',
    logoRemoveText: 'Deine Treuekarten zeigen danach kein Logo mehr.',
    loadError: 'Die Betriebsdaten konnten nicht geladen werden.',
  },
});

const COUNTRIES: Record<string, string> = {
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
  LI: 'Liechtenstein',
  LU: 'Luxemburg',
  BE: 'Belgien',
  NL: 'Niederlande',
  FR: 'Frankreich',
  IT: 'Italien',
  ES: 'Spanien',
  PT: 'Portugal',
  DK: 'Dänemark',
  SE: 'Schweden',
  PL: 'Polen',
  CZ: 'Tschechien',
  GB: 'Vereinigtes Königreich',
  IE: 'Irland',
};

const TIMEZONES: Record<string, string> = {
  'Europe/Berlin': 'Berlin (MEZ)',
  'Europe/Vienna': 'Wien (MEZ)',
  'Europe/Zurich': 'Zürich (MEZ)',
  'Europe/Luxembourg': 'Luxemburg (MEZ)',
  'Europe/Amsterdam': 'Amsterdam (MEZ)',
  'Europe/Brussels': 'Brüssel (MEZ)',
  'Europe/Paris': 'Paris (MEZ)',
  'Europe/Rome': 'Rom (MEZ)',
  'Europe/Madrid': 'Madrid (MEZ)',
  'Europe/Copenhagen': 'Kopenhagen (MEZ)',
  'Europe/Stockholm': 'Stockholm (MEZ)',
  'Europe/Warsaw': 'Warschau (MEZ)',
  'Europe/Prague': 'Prag (MEZ)',
  'Europe/London': 'London (GMT)',
  'Europe/Dublin': 'Dublin (GMT)',
  'Europe/Lisbon': 'Lissabon (WEZ)',
  'Europe/Athens': 'Athen (OEZ)',
  'Europe/Helsinki': 'Helsinki (OEZ)',
};

const CURRENCIES: Record<string, string> = { EUR: 'Euro (EUR)', CHF: 'Schweizer Franken (CHF)', GBP: 'Britisches Pfund (GBP)', USD: 'US-Dollar (USD)' };
const MAX_LOGO_BYTES = 512 * 1024;
const HEX = /^#[0-9a-fA-F]{6}$/;

interface FormState {
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  brandColor: string;
}

function toForm(org: OrganizationDto): FormState {
  return {
    name: org.name,
    industry: org.industry,
    email: org.email ?? '',
    phone: org.phone ?? '',
    website: org.website ?? '',
    addressLine: org.addressLine ?? '',
    postalCode: org.postalCode ?? '',
    city: org.city ?? '',
    country: org.country,
    timezone: org.timezone,
    currency: org.currency,
    brandColor: org.brandColor,
  };
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

function LogoCard({ org, editable, onChanged }: { org: OrganizationDto; editable: boolean; onChanged: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  const upload = async (file: File) => {
    setError(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) return setError(t.logoWrongType);
    if (file.size > MAX_LOGO_BYTES) return setError(t.logoTooLarge);
    setBusy(true);
    try {
      const dataBase64 = await readAsBase64(file);
      await api('/organization/logo', { method: 'PUT', body: { dataBase64 } });
      await onChanged();
      toast.success(t.logoUploaded);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.logoReadError);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await api('/organization/logo', { method: 'DELETE' });
      await onChanged();
      toast.success(t.logoRemoved);
      setConfirmRemove(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-ink">{t.logo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-sunken text-subtle">
          {org.logoAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/public/assets/${org.logoAssetId}`} alt={t.logoAlt} className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-7" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                aria-label={t.logoUpload}
                data-testid="logo-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file);
                }}
              />
              <Button variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
                {busy ? null : <Upload className="size-4" aria-hidden />}
                {org.logoAssetId ? t.logoReplace : t.logoUpload}
              </Button>
              {org.logoAssetId ? (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                  <Trash2 className="size-4" aria-hidden />
                  {t.logoRemove}
                </Button>
              ) : null}
            </div>
          ) : !org.logoAssetId ? (
            <p className="text-sm text-muted">{t.logoNone}</p>
          ) : null}
          {editable ? <p className="mt-2 text-sm text-muted">{t.logoHint}</p> : null}
          {error ? <p role="alert" className="mt-1 text-sm text-danger">{error}</p> : null}
        </div>
      </div>
      <ConfirmDialog open={confirmRemove} onOpenChange={setConfirmRemove} title={t.logoRemoveTitle} description={t.logoRemoveText} confirmLabel={t.logoRemove} danger loading={removing} onConfirm={remove} />
    </div>
  );
}

function withCurrent(options: Record<string, string>, current: string): Array<[string, string]> {
  const entries = Object.entries(options);
  return current && !(current in options) ? [[current, current], ...entries] : entries;
}

export function CompanySettings() {
  const t = useCopy(copy);
  const { can, refresh } = useSession();
  const toast = useToast();
  const editable = can('org.manage');
  const org = useSWR<OrganizationDto>('/organization');
  const [form, setForm] = React.useState<FormState | null>(null);
  const [colorError, setColorError] = React.useState<string | null>(null);

  // Formular einmalig mit den geladenen Daten füllen (und nach dem Speichern abgleichen).
  const loadedId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (org.data && loadedId.current !== org.data.id) {
      loadedId.current = org.data.id;
      setForm(toForm(org.data));
    }
  }, [org.data]);

  const save = useSubmit(async (values: FormState) => {
    const updated = await api<OrganizationDto>('/organization', {
      method: 'PATCH',
      body: {
        name: values.name,
        industry: values.industry,
        email: values.email.trim() || null,
        phone: values.phone,
        website: values.website,
        addressLine: values.addressLine,
        postalCode: values.postalCode,
        city: values.city,
        country: values.country,
        timezone: values.timezone,
        currency: values.currency,
        brandColor: values.brandColor,
      },
    });
    await org.mutate(updated, { revalidate: false });
    setForm(toForm(updated));
    await refresh();
    toast.success(t.saved);
  });

  if (org.error) return <Card><ErrorState description={t.loadError} onRetry={() => void org.mutate()} /></Card>;
  if (!org.data || !form) return <Stack><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></Stack>;

  const set = <K extends keyof FormState>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(org.data));
  const validColor = HEX.test(form.brandColor);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validColor) return setColorError(t.brandColorInvalid);
    setColorError(null);
    void save.submit(form);
  };

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <Stack>
        {!editable ? <Alert tone="info">{t.readOnly}</Alert> : null}
        {save.error ? <Alert tone="danger">{save.error}</Alert> : null}

        <Card>
          <CardHeader title={t.baseTitle} description={t.baseDescription} />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label={t.name} error={save.fields.name}>
              <Input value={form.name} onChange={set('name')} disabled={!editable} maxLength={80} required autoComplete="organization" />
            </Field>
            <Field label={t.industry} error={save.fields.industry}>
              <Select value={form.industry} onChange={set('industry')} disabled={!editable}>
                {INDUSTRIES.map((key) => <option key={key} value={key}>{industryLabel[key] ?? key}</option>)}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.contactTitle} />
          <CardBody className="grid gap-5 sm:grid-cols-6">
            <Field label={t.email} error={save.fields.email} optional className="sm:col-span-3">
              <Input type="email" value={form.email} onChange={set('email')} disabled={!editable} maxLength={254} autoComplete="email" />
            </Field>
            <Field label={t.phone} error={save.fields.phone} optional className="sm:col-span-3">
              <Input type="tel" value={form.phone} onChange={set('phone')} disabled={!editable} maxLength={40} autoComplete="tel" />
            </Field>
            <Field label={t.website} error={save.fields.website} optional className="sm:col-span-6">
              <Input type="url" value={form.website} onChange={set('website')} disabled={!editable} maxLength={200} placeholder="https://" autoComplete="url" />
            </Field>
            <Field label={t.address} error={save.fields.addressLine} optional className="sm:col-span-6">
              <Input value={form.addressLine} onChange={set('addressLine')} disabled={!editable} maxLength={120} autoComplete="street-address" />
            </Field>
            <Field label={t.postalCode} error={save.fields.postalCode} optional className="sm:col-span-2">
              <Input value={form.postalCode} onChange={set('postalCode')} disabled={!editable} maxLength={12} autoComplete="postal-code" />
            </Field>
            <Field label={t.city} error={save.fields.city} optional className="sm:col-span-4">
              <Input value={form.city} onChange={set('city')} disabled={!editable} maxLength={80} autoComplete="address-level2" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.regionTitle} />
          <CardBody className="grid gap-5 sm:grid-cols-3">
            <Field label={t.country} error={save.fields.country}>
              <Select value={form.country} onChange={set('country')} disabled={!editable}>
                {withCurrent(COUNTRIES, form.country).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </Select>
            </Field>
            <Field label={t.timezone} error={save.fields.timezone} hint={t.timezoneHint}>
              <Select value={form.timezone} onChange={set('timezone')} disabled={!editable}>
                {withCurrent(TIMEZONES, form.timezone).map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
              </Select>
            </Field>
            <Field label={t.currency} error={save.fields.currency}>
              <Select value={form.currency} onChange={set('currency')} disabled={!editable}>
                {withCurrent(CURRENCIES, form.currency).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.brandTitle} description={t.brandDescription} />
          <CardBody className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <input
                type="color"
                aria-label={t.brandColorPicker}
                value={validColor ? form.brandColor.toLowerCase() : '#1f3a2e'}
                onChange={(e) => (setColorError(null), setForm((f) => (f ? { ...f, brandColor: e.target.value.toUpperCase() } : f)))}
                disabled={!editable}
                className="mt-[26px] size-10 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <Field label={t.brandColor} error={colorError ?? save.fields.brandColor} hint={t.brandColorHint} className="min-w-0 flex-1">
                <Input id="brand-color-hex" value={form.brandColor} onChange={(e) => (setColorError(null), set('brandColor')(e))} disabled={!editable} maxLength={7} spellCheck={false} className="max-w-36 font-mono uppercase" />
              </Field>
            </div>
            <LogoCard org={org.data} editable={editable} onChanged={async () => { await org.mutate(); await refresh(); }} />
          </CardBody>
        </Card>

        {editable ? (
          <div className="flex justify-end">
            <Button type="submit" loading={save.loading} disabled={!dirty}>{t.save}</Button>
          </div>
        ) : null}
      </Stack>
    </form>
  );
}
