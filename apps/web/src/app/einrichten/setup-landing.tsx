'use client';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@tapperl/ui';

const PACKAGE = 'at.tapperl.einrichtung';

/**
 * Ziel des QR-Codes aus dem Dashboard. Öffnet die Tapperl-Einrichtungs-App
 * (Android) mit dem Einmal-Code. Der Code steht nur in der URL dieser Seite –
 * die Seite selbst sendet ihn nirgendwohin.
 */
export function SetupLanding() {
  const params = useSearchParams();
  const code = (params.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  const apiUrl = params.get('api') ?? '';
  const safeApi = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(apiUrl) || /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(apiUrl) ? apiUrl : '';
  const query = `code=${encodeURIComponent(code)}${safeApi ? `&api=${encodeURIComponent(safeApi)}` : ''}`;
  const here = typeof window !== 'undefined' ? `${window.location.origin}/einrichten?${query}&ohne-app=1` : '';
  const intentUrl = `intent://einrichten?${query}#Intent;scheme=tapperl;package=${PACKAGE};${here ? `S.browser_fallback_url=${encodeURIComponent(here)};` : ''}end`;
  const noApp = params.get('ohne-app') === '1';

  return (
    <main className="flex flex-1 flex-col gap-6">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold text-ink">Stempel einrichten</h1>
        <p className="mt-2 text-muted">Mit der Tapperl-Einrichtungs-App beschreibst du einen NTAG-424-DNA-Chip direkt mit deinem Android-Handy.</p>
      </div>

      {code ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="text-xs font-medium text-subtle">Einrichtungscode</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-ink">{code}</p>
        </div>
      ) : (
        <p className="rounded-xl bg-sunken p-4 text-sm text-muted">Kein Code gefunden. Erzeuge im Dashboard unter „Stempel“ → „Mit Android-Handy einrichten“ einen neuen.</p>
      )}

      {noApp ? (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-ink">
          Die App ist auf diesem Handy noch nicht installiert. Installiere die Datei <span className="font-mono">tapperl-einrichtung.apk</span> (von Tapperl erhalten) und öffne danach diesen Link erneut – oder tippe den Code in der App ein.
        </div>
      ) : null}

      {code ? (
        <a href={intentUrl} className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-5 font-semibold text-on-brand hover:opacity-90">
          In der Einrichtungs-App öffnen
        </a>
      ) : null}

      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>NFC am Handy einschalten (Einstellungen → Verbindungen → NFC).</li>
        <li>In der App „Einrichten“ tippen und den Chip flach an die Rückseite halten – nicht bewegen, bis „Fertig“ erscheint.</li>
        <li>Der Stempel ist danach sofort aktiv. Der Code ist nur einmal gültig.</li>
      </ol>
      <p className="text-xs text-subtle">Die Einrichtungs-App gibt es derzeit nur für Android.</p>
    </main>
  );
}
