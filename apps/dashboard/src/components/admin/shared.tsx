'use client';
import * as React from 'react';
import { Search } from 'lucide-react';
import { UNLIMITED } from '@tably/config';
import { ApiError, ErrorState, formatNumber, Input } from '@tably/ui';
import { auditAction } from '@/lib/labels';

export const orgStatus: Record<string, { label: string; tone: 'success' | 'danger' }> = {
  ACTIVE: { label: 'Aktiv', tone: 'success' },
  SUSPENDED: { label: 'Gesperrt', tone: 'danger' },
};
export const providerLabel: Record<string, string> = { LOCAL: 'Testmodus (keine Zahlung)', STRIPE: 'Stripe' };
export const actorLabel: Record<string, string> = { USER: 'Benutzer', SUPER_ADMIN: 'Plattformbetreiber', SYSTEM: 'System', CUSTOMER: 'Kunde', API_KEY: 'API-Schlüssel' };

/** Bezeichnungen für Admin-Aktionen, die in den zentralen Labels (noch) fehlen. */
const adminAuditAction: Record<string, string> = {
  'admin.user_disabled': 'Benutzer gesperrt',
  'admin.user_enabled': 'Benutzer entsperrt',
  'admin.plan_updated': 'Tarif geändert',
};
export function auditLabel(action: string): string {
  return auditAction[action] ?? adminAuditAction[action] ?? action;
}

export function formatLimit(limit: number): string {
  return limit === UNLIMITED ? 'unbegrenzt' : formatNumber(limit);
}

/** Suchfeld mit kurzer Verzögerung, damit nicht jeder Tastendruck eine Anfrage auslöst. */
export function SearchField({ onSearch, label, placeholder, className }: { onSearch: (q: string) => void; label: string; placeholder?: string; className?: string }) {
  const [text, setText] = React.useState('');
  const callback = React.useRef(onSearch);
  callback.current = onSearch;
  React.useEffect(() => {
    const timer = setTimeout(() => callback.current(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  return (
    <div className={`relative w-full sm:max-w-xs ${className ?? ''}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <Input type="search" value={text} onChange={(e) => setText(e.target.value)} aria-label={label} placeholder={placeholder ?? label} className="pl-9" maxLength={100} />
    </div>
  );
}

/** Fehlerzustand für Listen; nennt die Meldung der API, falls vorhanden. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <ErrorState description={error instanceof ApiError && error.status !== 0 && error.status < 500 ? error.message : undefined} onRetry={onRetry} />;
}

export function pagedKey(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  return `${path}?${search.toString()}`;
}

/** „29“, „29,90“ oder „29.90“ → Cent. Gibt null zurück, wenn die Eingabe kein gültiger Betrag ist. */
export function parseEuro(input: string): number | null {
  const normalized = input.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
