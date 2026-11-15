'use client';
import * as React from 'react';
import { ApiError } from '@tably/ui';

/**
 * Kapselt Absenden, Ladezustand und Fehler eines Formulars.
 * Feldfehler der API (`error.fields`) werden den Eingabefeldern zugeordnet.
 */
export function useSubmit<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [code, setCode] = React.useState<string | null>(null);
  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  const submit = React.useCallback(async (...args: Args): Promise<R | undefined> => {
    setLoading(true);
    setError(null);
    setFields({});
    setCode(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setCode(err.code);
        // Bei reinen Feldfehlern reicht die Markierung am Feld.
        setError(Object.keys(err.fields).length > 0 && err.code === 'validation_failed' ? 'Bitte prüfe die markierten Felder.' : err.message);
      } else {
        setError('Unerwarteter Fehler. Bitte versuche es erneut.');
      }
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error, fields, code, reset: () => (setError(null), setFields({}), setCode(null)) };
}
