import type { CampaignDto, CampaignType, WalletStatusDto } from '@tably/types';

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'honey';
export type Channel = CampaignDto['channels'][number];

/** Kampagnen, die nach dem Start dauerhaft laufen, statt einmal versendet zu werden. */
export const RUNNING_TYPES: CampaignType[] = ['BIRTHDAY', 'INACTIVITY', 'BONUS_STAMPS'];
export const isRunningType = (type: CampaignType) => RUNNING_TYPES.includes(type);

/** Welche Kanäle je Typ tatsächlich etwas bewirken. */
export const CHANNELS_BY_TYPE: Record<CampaignType, Channel[]> = {
  ANNOUNCEMENT: ['EMAIL', 'WALLET', 'CARD'],
  OFFER: ['EMAIL', 'WALLET', 'CARD'],
  BIRTHDAY: ['EMAIL', 'WALLET'],
  INACTIVITY: ['EMAIL', 'WALLET'],
  BONUS_STAMPS: ['CARD'],
};

export const channelHint: Record<Channel, string> = {
  EMAIL: 'Geht an Kunden, die eine E-Mail-Adresse angegeben und Neuigkeiten per E-Mail zugestimmt haben.',
  WALLET: 'Aktualisiert die Karte in Apple Wallet bzw. Google Wallet bei Kunden, die dem zugestimmt haben.',
  CARD: 'Erscheint als Hinweis auf der Webkarte, sobald Kunden ihre Karte öffnen. Dafür ist keine Einwilligung nötig.',
};

export const notificationStatus: Record<string, { label: string; tone: Tone }> = {
  QUEUED: { label: 'In Warteschlange', tone: 'info' },
  SENT: { label: 'Versendet', tone: 'success' },
  SENT_TEST: { label: 'Testmodus – nicht versendet', tone: 'honey' },
  FAILED: { label: 'Fehlgeschlagen', tone: 'danger' },
  SKIPPED: { label: 'Übersprungen', tone: 'neutral' },
};

/** Gründe, warum ein Empfänger keine Nachricht bekommen hat. */
export const skipReason: Record<string, string> = {
  no_consent: 'Keine Einwilligung für diesen Kanal',
  no_email: 'Keine E-Mail-Adresse hinterlegt',
  no_wallet_pass: 'Karte nicht in Apple oder Google Wallet gespeichert',
  wallet_not_configured: 'Wallet-Anbindung ist auf diesem System nicht eingerichtet',
};

export const WEEKDAYS: Array<{ value: number; short: string; long: string }> = [
  { value: 1, short: 'Mo', long: 'Montag' },
  { value: 2, short: 'Di', long: 'Dienstag' },
  { value: 3, short: 'Mi', long: 'Mittwoch' },
  { value: 4, short: 'Do', long: 'Donnerstag' },
  { value: 5, short: 'Fr', long: 'Freitag' },
  { value: 6, short: 'Sa', long: 'Samstag' },
  { value: 0, short: 'So', long: 'Sonntag' },
];

export function walletConfigured(status: WalletStatusDto | undefined): boolean {
  return Boolean(status && (status.apple.configured || status.google.configured));
}

/** Beschreibt eine Zielgruppe in einem Satzteil pro Bedingung. */
export function describeSegment(segment: CampaignDto['segment'], programName: string | null): string[] {
  const parts: string[] = [];
  if (segment.programId) parts.push(`Karte im Programm „${programName ?? 'unbekannt'}“`);
  if (segment.inactiveDays) parts.push(`seit mindestens ${segment.inactiveDays} Tagen nicht mehr da gewesen`);
  if (segment.activeDays) parts.push(`in den letzten ${segment.activeDays} Tagen aktiv`);
  if (segment.minBalance !== null && segment.minBalance > 0) parts.push(`mindestens ${segment.minBalance} Stempel auf der Karte`);
  if (segment.rewardReady) parts.push('Prämie einlösbar');
  return parts;
}

export function describeStats(stats: CampaignDto['stats']): Array<{ label: string; value: number; tone: Tone }> {
  return [
    { label: 'Versendet', value: stats.sent, tone: 'success' as Tone },
    { label: 'Testmodus', value: stats.sentTest, tone: 'honey' as Tone },
    { label: 'Übersprungen', value: stats.skipped, tone: 'neutral' as Tone },
    { label: 'Fehlgeschlagen', value: stats.failed, tone: 'danger' as Tone },
  ];
}
