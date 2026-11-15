import type { ApiErrorBody, ErrorCode } from '@tably/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Für Buchungen: gleiche Kennung bei Wiederholung derselben Aktion */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/**
 * Ruft die API über den Same-Origin-Proxy `/api` der jeweiligen App auf.
 * Cookies bleiben dadurch First-Party; der Schutz-Header gegen CSRF wird
 * automatisch gesetzt.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? (options.body !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Tably-Request'] = '1';
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: options.body !== undefined ? JSON.stringify(options.body) : undefined, credentials: 'same-origin', signal: options.signal, cache: 'no-store' });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'internal_error', 'Keine Verbindung. Bitte prüfe deine Internetverbindung.');
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const body = json as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error?.code ?? 'internal_error', body?.error?.message ?? 'Unerwarteter Fehler.', body?.error?.fields ?? {}, body?.error?.details ?? {});
  }
  return json as T;
}

export function newIdempotencyKey(): string {
  return `web-${crypto.randomUUID()}`;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Unerwarteter Fehler. Bitte versuche es erneut.';
}
