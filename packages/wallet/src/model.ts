/** Plattformneutrale Beschreibung einer Treuekarte für Wallet-Pässe. */
export interface WalletCardModel {
  serial: string;
  shortCode: string;
  organizationName: string;
  programName: string;
  cardTitle: string;
  description: string;
  customerName: string;
  balance: number;
  stampsRequired: number;
  /** Anzahl sofort einlösbarer Prämien */
  rewardsAvailable: number;
  rewardName: string;
  unitLabel: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  /** Link zur Webkarte (inkl. Zugriffstoken) */
  cardUrl: string;
  terms: string;
  expiresAt?: Date | null;
  /** Aktuelle Nachricht (z. B. Kampagne) – erscheint auf der Rückseite / als Mitteilung */
  message?: string | null;
  /** PNG des Händlerlogos, falls vorhanden */
  logoPng?: Buffer | null;
  /** Öffentliche HTTPS-URL eines Logos (Google Wallet verlangt eine URL) */
  logoUrl?: string | null;
}
