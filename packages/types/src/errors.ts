/**
 * Stabile, maschinenlesbare Fehlercodes der API. Die Oberflächen übersetzen
 * sie in verständliche Texte (siehe messages der Apps).
 */
export const ERROR_CODES = [
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'csrf_failed',
  'invalid_credentials',
  'account_locked',
  'email_not_verified',
  'mfa_required',
  'mfa_invalid',
  'token_invalid',
  'email_taken',
  'limit_reached',
  'feature_not_in_plan',
  'subscription_restricted',
  'organization_suspended',
  'program_not_published',
  'program_expired',
  'card_blocked',
  'customer_blocked',
  'insufficient_balance',
  'stamp_too_soon',
  'daily_limit_reached',
  'tap_invalid',
  'tap_replayed',
  'tap_expired',
  'tap_already_used',
  'device_inactive',
  'device_unassigned',
  'code_invalid',
  'simulator_disabled',
  'integration_not_configured',
  'internal_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    fields?: Record<string, string>;
  };
}
