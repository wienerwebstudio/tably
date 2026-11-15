'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { MapPin, Plus } from 'lucide-react';
import type { LocationDto } from '@tapperl/types';
import { Alert, api, ApiError, Badge, Button, Card, CardHeader, ConfirmDialog, defineCopy, Dialog, EmptyState, ErrorState, Field, Input, Skeleton, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { formatLimit } from './shared';

const copy = defineCopy({
  de: {
    title: 'Standorte',
    description: 'Filialen oder Verkaufsstellen, denen du NFC-Stempel und Buchungen zuordnest.',
    add: 'Standort anlegen',
    edit: 'Bearbeiten',
    activate: 'Aktivieren',
    deactivate: 'Deaktivieren',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    emptyTitle: 'Noch kein Standort',
    emptyText: 'Lege deinen ersten Standort an, um Stempel und Buchungen zuzuordnen.',
    createTitle: 'Neuer Standort',
    editTitle: 'Standort bearbeiten',
    name: 'Name',
    namePlaceholder: 'z. B. Filiale Hauptplatz',
    address: 'Straße und Hausnummer',
    postalCode: 'PLZ',
    city: 'Ort',
    cancel: 'Abbrechen',
    create: 'Anlegen',
    save: 'Speichern',
    created: 'Standort angelegt.',
    saved: 'Standort gespeichert.',
    activated: 'Standort aktiviert.',
    deactivated: 'Standort deaktiviert.',
    deactivateTitle: 'Standort deaktivieren?',
    deactivateText: 'Der Standort steht danach nicht mehr zur Auswahl. Bisherige Buchungen bleiben erhalten.',
    limitTitle: 'Limit deines Tarifs erreicht',
    limitLink: 'Tarif ansehen',
    noAddress: 'Keine Adresse hinterlegt',
    usage: (used: number, limit: string) => `${used} von ${limit} aktiven Standorten genutzt`,
    devices: (n: number) => (n === 1 ? '1 NFC-Stempel' : `${n} NFC-Stempel`),
  },
});

function LimitAlert({ message }: { message: string }) {
  const t = useCopy(copy);
  return (
    <Alert tone="warn" title={t.limitTitle} action={<Link href="/einstellungen?tab=abo" className="whitespace-nowrap text-sm font-semibold underline">{t.limitLink}</Link>}>
      {message}
    </Alert>
  );
}

function LocationDialog({ location, open, onOpenChange, onSaved }: { location: LocationDto | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const save = useSubmit(async (form: FormData) => {
    const body = { name: String(form.get('name') ?? ''), addressLine: String(form.get('addressLine') ?? '').trim() || null, postalCode: String(form.get('postalCode') ?? '').trim() || null, city: String(form.get('city') ?? '').trim() || null };
    if (location) await api(`/organization/locations/${location.id}`, { method: 'PATCH', body });
    else await api('/organization/locations', { body });
    await onSaved();
    toast.success(location ? t.saved : t.created);
    onOpenChange(false);
  });
  React.useEffect(() => {
    if (open) save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const formId = React.useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={location ? t.editTitle : t.createTitle}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button type="submit" form={formId} loading={save.loading}>{location ? t.save : t.create}</Button>
        </>
      }
    >
      <form method="post" id={formId} className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => (e.preventDefault(), void save.submit(new FormData(e.currentTarget)))} noValidate>
        {save.error ? <div className="sm:col-span-3">{save.code === 'limit_reached' ? <LimitAlert message={save.error} /> : <Alert tone="danger">{save.error}</Alert>}</div> : null}
        <Field label={t.name} error={save.fields.name} className="sm:col-span-3">
          <Input name="name" defaultValue={location?.name ?? ''} maxLength={80} required autoFocus placeholder={t.namePlaceholder} />
        </Field>
        <Field label={t.address} error={save.fields.addressLine} optional className="sm:col-span-3">
          <Input name="addressLine" defaultValue={location?.addressLine ?? ''} maxLength={120} />
        </Field>
        <Field label={t.postalCode} error={save.fields.postalCode} optional>
          <Input name="postalCode" defaultValue={location?.postalCode ?? ''} maxLength={12} />
        </Field>
        <Field label={t.city} error={save.fields.city} optional className="sm:col-span-2">
          <Input name="city" defaultValue={location?.city ?? ''} maxLength={80} />
        </Field>
      </form>
    </Dialog>
  );
}

export function LocationsSettings() {
  const t = useCopy(copy);
  const { me, refresh } = useSession();
  const toast = useToast();
  const locations = useSWR<LocationDto[]>('/organization/locations');
  const [dialog, setDialog] = React.useState<{ open: boolean; location: LocationDto | null }>({ open: false, location: null });
  const [deactivate, setDeactivate] = React.useState<LocationDto | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [limitError, setLimitError] = React.useState<string | null>(null);

  const reload = async () => {
    await locations.mutate();
    void refresh();
  };

  const setActive = async (location: LocationDto, isActive: boolean) => {
    setPending(location.id);
    setLimitError(null);
    try {
      await api(`/organization/locations/${location.id}`, { method: 'PATCH', body: { isActive } });
      await reload();
      toast.success(isActive ? t.activated : t.deactivated);
      setDeactivate(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'limit_reached') setLimitError(err.message);
      else toast.error(err instanceof ApiError ? err.message : 'Unerwarteter Fehler. Bitte versuche es erneut.');
      setDeactivate(null);
    } finally {
      setPending(null);
    }
  };

  const limit = me.subscription?.limits.locations;
  const activeCount = locations.data?.filter((l) => l.isActive).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {limitError ? <LimitAlert message={limitError} /> : null}
      <Card>
        <CardHeader
          title={t.title}
          description={
            <>
              {t.description}
              {locations.data && limit !== undefined ? <span className="mt-1 block tabular">{t.usage(activeCount, formatLimit(limit))}</span> : null}
            </>
          }
          action={<Button size="sm" onClick={() => setDialog({ open: true, location: null })}><Plus className="size-4" aria-hidden />{t.add}</Button>}
        />
        {locations.error ? (
          <ErrorState onRetry={() => void locations.mutate()} />
        ) : !locations.data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : locations.data.length === 0 ? (
          <EmptyState icon={<MapPin />} title={t.emptyTitle} description={t.emptyText} />
        ) : (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {locations.data.map((location) => {
              const address = [location.addressLine, [location.postalCode, location.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
              return (
                <li key={location.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      <span className="break-words">{location.name}</span>
                      <Badge tone={location.isActive ? 'success' : 'neutral'}>{location.isActive ? t.active : t.inactive}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {address || t.noAddress}
                      {location._count ? ` · ${t.devices(location._count.devices)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDialog({ open: true, location })}>{t.edit}</Button>
                    {location.isActive ? (
                      <Button variant="ghost" size="sm" onClick={() => setDeactivate(location)}>{t.deactivate}</Button>
                    ) : (
                      <Button variant="ghost" size="sm" loading={pending === location.id} onClick={() => void setActive(location, true)}>{t.activate}</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <LocationDialog key={dialog.location?.id ?? 'new'} location={dialog.location} open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(deactivate)}
        onOpenChange={(open) => !open && setDeactivate(null)}
        title={t.deactivateTitle}
        description={t.deactivateText}
        confirmLabel={t.deactivate}
        loading={Boolean(deactivate && pending === deactivate.id)}
        onConfirm={() => (deactivate ? setActive(deactivate, false) : undefined)}
      />
    </div>
  );
}
