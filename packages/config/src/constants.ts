export const APP_NAME = 'Tapperl';

export const INDUSTRIES = [
  'cafe',
  'bakery',
  'restaurant',
  'hairdresser',
  'barbershop',
  'beauty',
  'fitness',
  'florist',
  'retail',
  'carwash',
  'nails',
  'services',
  'other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const SESSION_TTL_DAYS = 30;
export const CUSTOMER_SESSION_TTL_DAYS = 400;
/** Wie lange ein verifizierter Tap eingelöst werden kann (Sekunden). */
export const TAP_TTL_SECONDS = 180;
/** Gültigkeit eines Einlöse-Codes (Sekunden). */
export const REDEMPTION_CODE_TTL_SECONDS = 300;
export const PRIVACY_POLICY_VERSION = '2026-11';

export const SESSION_COOKIE = 'tapperl_session';
export const CUSTOMER_COOKIE = 'tapperl_customer';
