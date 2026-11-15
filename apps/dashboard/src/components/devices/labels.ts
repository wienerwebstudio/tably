import type { DeviceDto, DeviceKind, DeviceSecurity } from '@tapperl/types';

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'honey';

/** Kurze Bezeichnungen der Stempel-Art für Listen (ausführlich: labels.deviceKind). */
export const kindShort: Record<DeviceKind, string> = {
  PASSIVE_NTAG424: 'NFC-Stempel',
  SIMULATED: 'Simulation',
  ACTIVE_READER: 'Aktiver Stempel',
};

/** Verständliche Bezeichnungen für die Einträge im Geräteprotokoll. */
export const deviceEvent: Record<string, { label: string; hint: string; tone: Tone }> = {
  REGISTERED: { label: 'Registriert', hint: 'Der Stempel wurde in Tapperl angelegt.', tone: 'info' },
  ACTIVATED: { label: 'Aktiviert', hint: 'Der erste gültige Tap hat den Stempel in Betrieb genommen.', tone: 'success' },
  TAP_OK: { label: 'Gültiger Tap', hint: 'Ein Smartphone hat den Stempel gelesen, die Prüfung war erfolgreich.', tone: 'success' },
  MAC_INVALID: { label: 'Ungültige Signatur', hint: 'Die Prüfsumme des Taps war falsch – z. B. eine veränderte oder erfundene Adresse.', tone: 'danger' },
  REPLAY: { label: 'Wiederholter Tap', hint: 'Derselbe Tap-Link wurde ein zweites Mal aufgerufen. Jeder Tap zählt nur einmal.', tone: 'warn' },
  UID_MISMATCH: { label: 'Fremder Chip', hint: 'Der Tap kam von einem anderen Chip als dem hier aktivierten.', tone: 'danger' },
  TAP_REJECTED: { label: 'Tap abgelehnt', hint: 'Der Tap wurde nicht angenommen, z. B. weil der Stempel deaktiviert ist.', tone: 'warn' },
  STATUS_CHANGED: { label: 'Status geändert', hint: 'Jemand aus dem Team hat den Status des Stempels geändert.', tone: 'neutral' },
  KEYS_ROTATED: { label: 'Schlüssel erneuert', hint: 'Es wurden neue geheime Schlüssel erzeugt. Alte Tap-Links sind seitdem wertlos.', tone: 'info' },
  KEYS_REVEALED: { label: 'Schlüssel abgerufen', hint: 'Die Personalisierungsdaten mit den geheimen Schlüsseln wurden angezeigt.', tone: 'warn' },
  VELOCITY_WARNING: { label: 'Ungewöhnlich viele Taps', hint: 'In kurzer Zeit kamen auffällig viele Taps an diesem Stempel an.', tone: 'warn' },
  SIGNATURE_REJECTED: { label: 'Signatur abgelehnt', hint: 'Eine signierte Meldung des Geräts konnte nicht bestätigt werden.', tone: 'danger' },
};

const STATUS_WORD: Record<string, string> = { PENDING: 'wartet auf Aktivierung', ACTIVE: 'aktiv', DISABLED: 'deaktiviert', LOST: 'verloren gemeldet', RETIRED: 'außer Betrieb' };
const REJECT_REASON: Record<string, string> = {
  device_disabled: 'Stempel war deaktiviert',
  device_lost: 'Stempel war als verloren gemeldet',
  device_retired: 'Stempel war außer Betrieb',
};

/** Fasst die Zusatzangaben eines Protokolleintrags in einem kurzen Satz zusammen. */
export function describeEvent(type: string, detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;
  const parts: string[] = [];
  if (type === 'STATUS_CHANGED') {
    const from = STATUS_WORD[String(detail.from)] ?? String(detail.from ?? '');
    const to = STATUS_WORD[String(detail.to)] ?? String(detail.to ?? '');
    parts.push(`${from} → ${to}`);
    if (typeof detail.reason === 'string' && detail.reason) parts.push(`Begründung: ${detail.reason}`);
    return parts.join(' · ');
  }
  if (type === 'VELOCITY_WARNING' && typeof detail.tapsInWindow === 'number') return `${detail.tapsInWindow} Taps in ${String(detail.windowMinutes ?? '?')} Minuten`;
  if (type === 'REGISTERED') return detail.kind === 'SIMULATED' ? 'Simulierter Stempel' : null;
  if (typeof detail.reason === 'string' && REJECT_REASON[detail.reason]) parts.push(REJECT_REASON[detail.reason]!);
  if (typeof detail.keyVersion === 'number') parts.push(`Schlüsselversion ${detail.keyVersion}`);
  if (typeof detail.counter === 'number') parts.push(`Zählerstand ${detail.counter}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export const securityHelp: Record<DeviceSecurity, { title: string; text: string; todo: string | null }> = {
  OK: { title: 'Alles unauffällig', text: 'Alle Taps der letzten Zeit ließen sich einwandfrei prüfen.', todo: null },
  WARNING: {
    title: 'Dieser Stempel fällt auf',
    text: 'Es gab mehrere Taps, die sich nicht bestätigen ließen. Das passiert etwa, wenn jemand einen alten Tap-Link erneut öffnet oder eine Adresse von Hand verändert. Gültige Taps funktionieren weiterhin.',
    todo: 'Sieh dir das Geräteprotokoll unten an. Häufen sich „Ungültige Signatur“ oder „Fremder Chip“, erneuere die Schlüssel und personalisiere den Chip neu. Einzelne „Wiederholte Taps“ sind harmlos.',
  },
  COMPROMISED: {
    title: 'Dieser Stempel ist gesperrt',
    text: 'Der Stempel wurde als verloren gemeldet oder gilt als unsicher. Mit den bisherigen Schlüsseln nimmt Tapperl keine Taps mehr an – niemand kann damit Stempel sammeln.',
    todo: 'Wenn du den Chip noch hast und weiter nutzen möchtest: Erneuere die Schlüssel und personalisiere ihn neu. Andernfalls nimm ihn außer Betrieb und registriere einen neuen Stempel.',
  },
};

export function isPhysical(device: Pick<DeviceDto, 'kind'>): boolean {
  return device.kind === 'PASSIVE_NTAG424';
}
