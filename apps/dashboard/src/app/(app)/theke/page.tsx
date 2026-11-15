'use client';
import * as React from 'react';
import { MapPin } from 'lucide-react';
import { defineCopy, ErrorState, PageHeader, Select, Skeleton, useCopy } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { CardLookup } from '@/components/counter/card-lookup';
import { useCounterLocation } from '@/components/counter/hooks';
import { PendingTaps } from '@/components/counter/pending-taps';
import { RedeemCode } from '@/components/counter/redeem-code';
import { SimulationPanel } from '@/components/counter/simulation';

const copy = defineCopy({
  de: {
    title: 'Theke',
    description: 'Taps freigeben, Stempel geben und Prämien einlösen – alles an einem Ort.',
    location: 'Standort',
    noLocation: 'Ohne Standort',
    locationHint: 'Wähle deinen Standort, damit Buchungen richtig zugeordnet werden.',
    locationSaved: (name: string) => `Standort ${name} gewählt.`,
    locationCleared: 'Buchungen werden ohne Standort gespeichert.',
    forbiddenTitle: 'Kein Zugriff auf die Theke',
    forbiddenText: 'Dir fehlt die Berechtigung, Stempel zu vergeben. Bitte wende dich an die Inhaberin oder den Inhaber.',
  },
});

function LocationPicker({ state }: { state: ReturnType<typeof useCounterLocation> }) {
  const t = useCopy(copy);
  const id = React.useId();
  const [announce, setAnnounce] = React.useState('');
  if (state.loading) return <Skeleton className="h-12 w-full rounded-lg sm:w-56" />;
  if (state.locations.length === 0) return null;
  const single = state.locations.length === 1 ? state.locations[0] : undefined;
  return (
    <div className="w-full sm:w-auto">
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
        <MapPin className="size-3.5" aria-hidden />
        {t.location}
      </label>
      {single ? (
        <p id={id} className="flex h-12 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink sm:min-w-56">{single.name}</p>
      ) : (
        <Select
          id={id}
          className="h-12 sm:min-w-56"
          value={state.locationId ?? ''}
          aria-describedby={state.locationId ? undefined : `${id}-hint`}
          onChange={(e) => {
            const value = e.target.value || null;
            state.setLocationId(value);
            const name = state.locations.find((l) => l.id === value)?.name;
            setAnnounce(name ? t.locationSaved(name) : t.locationCleared);
          }}
        >
          <option value="">{t.noLocation}</option>
          {state.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      )}
      {!single && !state.locationId ? <p id={`${id}-hint`} className="mt-1 max-w-56 text-xs text-warn">{t.locationHint}</p> : null}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}

export default function CounterPage() {
  const t = useCopy(copy);
  const { can } = useSession();
  const location = useCounterLocation();

  if (!can('stamps.grant')) {
    return (
      <>
        <PageHeader title={t.title} />
        <ErrorState title={t.forbiddenTitle} description={t.forbiddenText} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={<LocationPicker state={location} />} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <PendingTaps />
          <CardLookup locationId={location.locationId} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <RedeemCode locationId={location.locationId} />
          {can('customers.read') ? <SimulationPanel /> : null}
        </div>
      </div>
    </>
  );
}
