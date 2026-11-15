'use client';
import * as React from 'react';

export type Locale = 'de' | 'en';
const LocaleContext = React.createContext<Locale>('de');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

/**
 * Texte werden getrennt vom Markup in `copy`-Objekten gehalten. Deutsch ist
 * vollständig; weitere Sprachen ergänzen dasselbe Objekt und fallen bei
 * fehlenden Einträgen auf Deutsch zurück.
 *
 *   const copy = defineCopy({ de: { title: 'Kunden' }, en: { title: 'Customers' } });
 *   const t = useCopy(copy);
 */
export function defineCopy<T extends Record<string, unknown>>(copy: { de: T; en?: Partial<T> }): { de: T; en?: Partial<T> } {
  return copy;
}

export function useCopy<T extends Record<string, unknown>>(copy: { de: T; en?: Partial<T> }): T {
  const locale = useLocale();
  return React.useMemo(() => (locale === 'de' || !copy.en ? copy.de : { ...copy.de, ...copy.en }), [locale, copy]);
}
