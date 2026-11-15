import type { NextFunction, Request, Response } from 'express';
import type { Env } from './env';

/**
 * CSRF-Schutz für Cookie-authentifizierte Routen:
 *  1. Cookies sind SameSite=Lax.
 *  2. Schreibende Anfragen brauchen den Header `X-Tapperl-Request` – den kann
 *     ein fremdes Formular nicht setzen, und Cross-Origin-fetch scheitert an
 *     CORS (es sind nur die eigenen Oberflächen freigegeben).
 *  3. Ein vorhandener Origin-Header muss zu den eigenen Oberflächen gehören.
 *
 * Ausgenommen sind Endpunkte mit eigener Authentifizierung ohne Cookies
 * (Webhooks, Wallet-Webservice, Kassen- und Geräte-API).
 */
const EXEMPT_PREFIXES = ['/billing/webhooks/', '/wallet/apple/v1/', '/integrations/', '/devices/v1/'];

export function csrfMiddleware(env: Env) {
  const allowed = new Set([new URL(env.WEB_URL).origin, new URL(env.DASHBOARD_URL).origin]);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) return next();
    const origin = req.headers.origin;
    const originOk = typeof origin !== 'string' || allowed.has(origin);
    if (!originOk || req.headers['x-tapperl-request'] !== '1') {
      res.status(403).json({ error: { code: 'csrf_failed', message: 'Anfrage abgelehnt (CSRF-Schutz).' } });
      return;
    }
    next();
  };
}
