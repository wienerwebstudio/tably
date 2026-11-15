'use client';
import * as React from 'react';
import useSWR from 'swr';
import type { LocationDto } from '@tapperl/types';
import { ApiError, newIdempotencyKey } from '@tapperl/ui';
import { useSession } from '@/lib/session';

/**
 * Verwaltet Idempotency-Keys pro „Klick-Absicht“.
 * Der Schlüssel wird beim ersten Versuch erzeugt und so lange wiederverwendet,
 * bis die API eindeutig geantwortet hat (Erfolg oder fachliche Ablehnung).
 * Bei Verbindungs- oder Serverfehlern bleibt er erhalten, damit ein erneuter
 * Klick dieselbe Buchung nicht doppelt auslöst.
 */
export function useIntentKeys() {
  const keys = React.useRef(new Map<string, string>());
  return React.useCallback(async function run<R>(intent: string, fn: (idempotencyKey: string) => Promise<R>): Promise<R> {
    let key = keys.current.get(intent);
    if (!key) {
      key = newIdempotencyKey();
      keys.current.set(intent, key);
    }
    try {
      const result = await fn(key);
      keys.current.delete(intent);
      return result;
    } catch (err) {
      const definitive = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
      if (definitive) keys.current.delete(intent);
      throw err;
    }
  }, []);
}

/** Aktuelle Zeit, die sich im Takt aktualisiert (für Countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Standort der Theke: aktive Standorte laden, Auswahl im Browser merken.
 * `locationId` ist nur gesetzt, wenn der gemerkte Standort noch aktiv ist.
 */
export function useCounterLocation() {
  const { me } = useSession();
  const storageKey = `tapperl-theke-standort:${me.organization?.id ?? ''}`;
  const { data, error, isLoading, mutate } = useSWR<LocationDto[]>('/organization/locations');
  const [stored, setStored] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      setStored(localStorage.getItem(storageKey));
    } catch {
      /* Speicher nicht verfügbar */
    }
    setReady(true);
  }, [storageKey]);

  const locations = React.useMemo(() => (data ?? []).filter((l) => l.isActive), [data]);
  const only = locations.length === 1 ? locations[0] : undefined;
  const locationId = only ? only.id : stored && locations.some((l) => l.id === stored) ? stored : null;

  const setLocationId = React.useCallback(
    (id: string | null) => {
      setStored(id);
      try {
        if (id) localStorage.setItem(storageKey, id);
        else localStorage.removeItem(storageKey);
      } catch {
        /* Speicher nicht verfügbar */
      }
    },
    [storageKey],
  );

  return { locations, locationId, setLocationId, loading: isLoading || !ready, error, retry: () => void mutate() };
}

/** Kartencode tolerant in das Format XXXX-XXXX bringen. */
export function formatCardCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}
