import type { BookingPolicy, CampaignStatus, CampaignType, DeviceKind, DeviceSecurity, DeviceStatus, ProgramStatus, Role, SubscriptionStatus, TransactionSource, TransactionType } from '@tably/types';

/** Zentrale deutsche Bezeichnungen für Aufzählungswerte der API. */
type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'honey';

export const roleLabel: Record<Role, string> = { OWNER: 'Inhaber:in', ADMIN: 'Administrator:in', MANAGER: 'Filialleitung', STAFF: 'Mitarbeiter:in' };
export const roleHint: Record<Role, string> = {
  OWNER: 'Voller Zugriff inklusive Abrechnung',
  ADMIN: 'Alles außer Abrechnung',
  MANAGER: 'Karten, Stempel, Kunden, Marketing und Analysen',
  STAFF: 'Stempeln, Prämien einlösen, Kunden ansehen',
};

export const programStatus: Record<ProgramStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Entwurf', tone: 'neutral' },
  PUBLISHED: { label: 'Veröffentlicht', tone: 'success' },
  PAUSED: { label: 'Pausiert', tone: 'warn' },
  ARCHIVED: { label: 'Archiviert', tone: 'neutral' },
};

export const policyLabel: Record<BookingPolicy, { label: string; hint: string }> = {
  AUTO: { label: 'Automatisch', hint: 'Der Stempel wird direkt nach dem Tap gutgeschrieben. Mindestabstand und Tageslimit schützen vor Missbrauch.' },
  STAFF_CONFIRM: { label: 'Freigabe durch Team', hint: 'Jeder Tap erscheint an der Theke und wird von Mitarbeitenden bestätigt.' },
  POS_EVENT: { label: 'Kassen-Ereignis', hint: 'Ein Stempel wird nur vergeben, wenn die Kasse einen passenden Kauf meldet (Kassen-Schnittstelle nötig).' },
};

export const deviceStatus: Record<DeviceStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Wartet auf Aktivierung', tone: 'warn' },
  ACTIVE: { label: 'Aktiv', tone: 'success' },
  DISABLED: { label: 'Deaktiviert', tone: 'neutral' },
  LOST: { label: 'Verloren gemeldet', tone: 'danger' },
  RETIRED: { label: 'Außer Betrieb', tone: 'neutral' },
};
export const deviceSecurity: Record<DeviceSecurity, { label: string; tone: Tone }> = {
  OK: { label: 'Unauffällig', tone: 'success' },
  WARNING: { label: 'Auffällig', tone: 'warn' },
  COMPROMISED: { label: 'Gesperrt', tone: 'danger' },
};
export const deviceKind: Record<DeviceKind, string> = { PASSIVE_NTAG424: 'NFC-Stempel (NTAG 424 DNA)', SIMULATED: 'Simulierter Stempel', ACTIVE_READER: 'Aktiver Stempel' };

export const txType: Record<TransactionType, { label: string; tone: Tone }> = {
  EARN: { label: 'Stempel', tone: 'success' },
  REDEEM: { label: 'Einlösung', tone: 'honey' },
  ADJUST: { label: 'Korrektur', tone: 'info' },
  REVERSAL: { label: 'Storno', tone: 'danger' },
};
export const txSource: Record<TransactionSource, string> = {
  NFC_TAP: 'NFC-Stempel',
  SIMULATED_TAP: 'Simulation',
  ACTIVE_READER: 'Aktiver Stempel',
  MANUAL: 'Manuell',
  POS: 'Kasse',
  CAMPAIGN: 'Kampagne',
  SIGNUP_BONUS: 'Willkommensbonus',
  API: 'API',
};
export const flagReason: Record<string, string> = {
  limit_override_interval: 'Mindestabstand übersteuert',
  limit_override_daily: 'Tageslimit übersteuert',
  staff_manual_velocity: 'Viele manuelle Stempel in kurzer Zeit',
  device_velocity: 'Ungewöhnlich viele Taps am Stempel',
};

export const subscriptionStatus: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  TRIALING: { label: 'Testphase', tone: 'info' },
  ACTIVE: { label: 'Aktiv', tone: 'success' },
  PAST_DUE: { label: 'Zahlung offen', tone: 'warn' },
  RESTRICTED: { label: 'Eingeschränkt', tone: 'danger' },
  CANCELED: { label: 'Gekündigt', tone: 'neutral' },
};

export const campaignType: Record<CampaignType, { label: string; hint: string }> = {
  ANNOUNCEMENT: { label: 'Ankündigung', hint: 'Einmalige Nachricht an eine Zielgruppe' },
  OFFER: { label: 'Angebot', hint: 'Aktion mit Laufzeit, sichtbar auf der Karte' },
  BIRTHDAY: { label: 'Geburtstag', hint: 'Automatischer Gruß am Geburtstag, optional mit Bonusstempel' },
  INACTIVITY: { label: 'Rückgewinnung', hint: 'Automatische Erinnerung nach längerer Pause' },
  BONUS_STAMPS: { label: 'Bonus-Stempel', hint: 'Mehrfache Stempel in einem Zeitraum' },
};
export const campaignStatus: Record<CampaignStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Entwurf', tone: 'neutral' },
  SCHEDULED: { label: 'Geplant', tone: 'info' },
  SENDING: { label: 'Wird gesendet', tone: 'info' },
  SENT: { label: 'Gesendet', tone: 'success' },
  ACTIVE: { label: 'Läuft', tone: 'success' },
  PAUSED: { label: 'Pausiert', tone: 'warn' },
  ENDED: { label: 'Beendet', tone: 'neutral' },
  FAILED: { label: 'Fehlgeschlagen', tone: 'danger' },
};
export const channelLabel: Record<string, string> = { EMAIL: 'E-Mail', WALLET: 'Wallet-Karte', CARD: 'Webkarte' };

export const industryLabel: Record<string, string> = {
  cafe: 'Café',
  bakery: 'Bäckerei',
  restaurant: 'Restaurant',
  hairdresser: 'Friseursalon',
  barbershop: 'Barbershop',
  beauty: 'Kosmetikstudio',
  fitness: 'Fitnessstudio',
  florist: 'Blumenladen',
  retail: 'Einzelhandel',
  carwash: 'Autowaschanlage',
  nails: 'Nagelstudio',
  services: 'Dienstleistung',
  other: 'Andere Branche',
};

export const limitLabel: Record<string, string> = {
  locations: 'Standorte',
  devices: 'NFC-Stempel',
  programs: 'Treueprogramme',
  staff: 'Teammitglieder',
  customers: 'Kunden',
  campaignsPerMonth: 'Kampagnen pro Monat',
};
export const featureLabel: Record<string, string> = {
  walletPasses: 'Apple- und Google-Wallet-Karten',
  emailCampaigns: 'E-Mail-Kampagnen',
  automations: 'Automatische Kampagnen',
  advancedAnalytics: 'Erweiterte Analysen',
  posApi: 'Kassen-Schnittstelle',
  prioritySupport: 'Bevorzugter Support',
};

export const auditAction: Record<string, string> = {
  'auth.register': 'Konto erstellt',
  'auth.login': 'Anmeldung',
  'auth.locked': 'Konto vorübergehend gesperrt',
  'auth.password_reset': 'Passwort zurückgesetzt',
  'auth.password_changed': 'Passwort geändert',
  'auth.mfa_enabled': 'Zwei-Faktor-Anmeldung aktiviert',
  'auth.mfa_disabled': 'Zwei-Faktor-Anmeldung deaktiviert',
  'auth.mfa_failed': 'Falscher Zwei-Faktor-Code',
  'organization.updated': 'Betriebsdaten geändert',
  'organization.logo_updated': 'Logo geändert',
  'location.created': 'Standort angelegt',
  'location.updated': 'Standort geändert',
  'member.invited': 'Teammitglied eingeladen',
  'member.joined': 'Teammitglied beigetreten',
  'member.role_changed': 'Rolle geändert',
  'member.removed': 'Teammitglied entfernt',
  'member.invitation_revoked': 'Einladung zurückgezogen',
  'apikey.created': 'API-Schlüssel erstellt',
  'apikey.revoked': 'API-Schlüssel widerrufen',
  'program.created': 'Treueprogramm angelegt',
  'program.updated': 'Treueprogramm geändert',
  'program.published': 'Treueprogramm veröffentlicht',
  'program.paused': 'Treueprogramm pausiert',
  'program.archived': 'Treueprogramm archiviert',
  'reward.created': 'Prämie angelegt',
  'reward.updated': 'Prämie geändert',
  'reward.removed': 'Prämie entfernt',
  'reward.redeemed': 'Prämie eingelöst',
  'customer.created': 'Kunde angelegt',
  'customer.updated': 'Kunde geändert',
  'customer.blocked': 'Kunde gesperrt',
  'customer.active': 'Kunde entsperrt',
  'customer.enrolled': 'Kunde hat sich angemeldet',
  'customer.consent_changed': 'Einwilligung geändert',
  'customer.exported': 'Kundendaten exportiert',
  'customer.list_exported': 'Kundenliste exportiert',
  'customer.anonymized': 'Kundendaten gelöscht',
  'customer.self_export': 'Kunde hat Daten abgerufen',
  'customer.self_deleted': 'Kunde hat Daten gelöscht',
  'stamp.manual': 'Manueller Stempel',
  'stamp.adjusted': 'Stand korrigiert',
  'stamp.reversed': 'Buchung storniert',
  'tap.approved': 'Tap freigegeben',
  'tap.rejected': 'Tap abgelehnt',
  'device.registered': 'Stempel registriert',
  'device.updated': 'Stempel geändert',
  'device.activated': 'Stempel aktiviert',
  'device.active': 'Stempel aktiviert',
  'device.disabled': 'Stempel deaktiviert',
  'device.lost': 'Stempel als verloren gemeldet',
  'device.retired': 'Stempel außer Betrieb genommen',
  'device.keys_rotated': 'Stempel-Schlüssel erneuert',
  'device.keys_revealed': 'Stempel-Schlüssel abgerufen',
  'device.security_warning': 'Sicherheitswarnung am Stempel',
  'device.compromised': 'Stempel gesperrt (Sicherheitsvorfall)',
  'campaign.created': 'Kampagne angelegt',
  'campaign.updated': 'Kampagne geändert',
  'campaign.deleted': 'Kampagne gelöscht',
  'campaign.launched': 'Kampagne gestartet',
  'campaign.paused': 'Kampagne pausiert',
  'campaign.resumed': 'Kampagne fortgesetzt',
  'campaign.ended': 'Kampagne beendet',
  'billing.plan_changed': 'Tarif geändert',
  'billing.canceled': 'Abonnement gekündigt',
  'billing.resumed': 'Kündigung zurückgenommen',
  'billing.simulated': 'Zahlungsereignis simuliert (Testmodus)',
  'billing.subscription_synced': 'Abonnement mit Stripe abgeglichen',
  'billing.payment_failed': 'Zahlung fehlgeschlagen',
  'admin.organization_updated': 'Vom Plattformbetreiber geändert',
};
