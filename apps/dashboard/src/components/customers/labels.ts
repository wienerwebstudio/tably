import type { CustomerDto } from '@tably/types';

/** Bezeichnungen, die nur in den Kundenansichten gebraucht werden. */
type Tone = 'neutral' | 'success' | 'danger' | 'warn';

export const customerStatus: Record<CustomerDto['status'], { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Aktiv', tone: 'success' },
  BLOCKED: { label: 'Gesperrt', tone: 'danger' },
  ANONYMIZED: { label: 'Gelöscht', tone: 'neutral' },
};

export const cardStatus: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Aktiv', tone: 'success' },
  BLOCKED: { label: 'Gesperrt', tone: 'danger' },
  EXPIRED: { label: 'Abgelaufen', tone: 'warn' },
};

export const customerSource: Record<string, string> = {
  staff: 'Vom Team angelegt',
  signup: 'Selbst angemeldet',
  nfc_tap: 'Am NFC-Stempel angemeldet',
  demo: 'Demo-Daten',
};

export const walletLabel: Record<'APPLE' | 'GOOGLE', string> = { APPLE: 'Apple Wallet', GOOGLE: 'Google Wallet' };

export const consentLabel: Record<'TERMS' | 'PRIVACY' | 'MARKETING_EMAIL' | 'MARKETING_WALLET', { label: string; hint: string }> = {
  TERMS: { label: 'Teilnahmebedingungen', hint: 'Bei der Anmeldung akzeptiert' },
  PRIVACY: { label: 'Datenschutzerklärung', hint: 'Bei der Anmeldung akzeptiert' },
  MARKETING_EMAIL: { label: 'Neuigkeiten per E-Mail', hint: 'Angebote und Aktionen per E-Mail' },
  MARKETING_WALLET: { label: 'Mitteilungen auf der Karte', hint: 'Angebote und Hinweise direkt auf der Wallet- oder Webkarte' },
};
