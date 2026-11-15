'use client';
import * as React from 'react';
import useSWR from 'swr';
import type { MeDto, Permission } from '@tably/types';
import { ApiError } from '@tably/ui';

interface SessionValue {
  me: MeDto;
  can: (permission: Permission) => boolean;
  refresh: () => Promise<unknown>;
}

const SessionContext = React.createContext<SessionValue | null>(null);

/** Lädt die Sitzung. `status` unterscheidet sauber zwischen „lädt“, „nicht angemeldet“ und Fehler. */
export function useMe() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<MeDto, ApiError>('/auth/me', { revalidateOnFocus: true, revalidateOnMount: true, dedupingInterval: 0 });
  // Solange eine Abfrage läuft, gilt ein älterer Fehler nicht als Ergebnis – sonst würde eine
  // veraltete „nicht angemeldet“-Antwort direkt nach dem Login zurück zur Anmeldung führen.
  const status: 'loading' | 'authenticated' | 'unauthenticated' | 'error' = data ? 'authenticated' : isLoading || isValidating ? 'loading' : error?.status === 401 ? 'unauthenticated' : 'error';
  return { me: data, status, refresh: mutate };
}

export function SessionProvider({ me, refresh, children }: { me: MeDto; refresh: () => Promise<unknown>; children: React.ReactNode }) {
  const value = React.useMemo<SessionValue>(() => ({ me, refresh, can: (p) => me.permissions.includes(p) }), [me, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = React.useContext(SessionContext);
  if (!value) throw new Error('useSession außerhalb des geschützten Bereichs verwendet');
  return value;
}
