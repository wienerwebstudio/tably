import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: optional,
  /** `bullmq` braucht Redis. `inline` führt Jobs direkt im Prozess aus (Tests, Minimalbetrieb). */
  QUEUE_DRIVER: z.enum(['bullmq', 'inline']).default('inline'),
  API_PORT: z.coerce.number().int().default(4000),
  /** Öffentliche Basis-URL der Kunden-Website (Karte, Tap-Links). */
  WEB_URL: z.string().url().default('http://localhost:3000'),
  /** Öffentliche Basis-URL des Händler-Dashboards. */
  DASHBOARD_URL: z.string().url().default('http://localhost:3001'),
  /** Öffentliche Basis-URL der API (für Wallet-Webservice und Webhooks). */
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  /**
   * 32 Byte (64 Hex-Zeichen). Verschlüsselt ruhende Geheimnisse (NFC-Schlüssel,
   * TOTP-Secrets, Wallet-Tokens) und leitet NFC-Schlüssel ab. In Produktion Pflicht.
   */
  APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  /** Aktiviert den klar gekennzeichneten NFC-Simulationsmodus. */
  NFC_SIMULATOR_ENABLED: bool,
  TRUST_PROXY: bool,
  /** Nur für automatisierte Tests: schaltet das Rate Limiting ab. In Produktion nicht erlaubt. */
  RATE_LIMIT_DISABLED: bool,
  COOKIE_SECURE: bool,

  // E-Mail (optional – ohne SMTP wird der lokale Testmodus verwendet)
  SMTP_URL: optional,
  /** Alternative zu SMTP_URL: Einzelwerte (praktisch, wenn das Passwort Sonderzeichen enthält) */
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: z.string().default('Tapperl <no-reply@tapperl.local>'),

  // Stripe (optional – ohne Schlüssel läuft die Abrechnung im lokalen Testmodus)
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,

  // Apple Wallet (optional)
  APPLE_PASS_TYPE_ID: optional,
  APPLE_TEAM_ID: optional,
  APPLE_PASS_CERT_PEM: optional,
  APPLE_PASS_KEY_PEM: optional,
  APPLE_PASS_KEY_PASSPHRASE: optional,
  APPLE_WWDR_CERT_PEM: optional,

  // Google Wallet (optional)
  GOOGLE_WALLET_ISSUER_ID: optional,
  GOOGLE_WALLET_SA_EMAIL: optional,
  GOOGLE_WALLET_SA_PRIVATE_KEY: optional,

  // Super-Admin-Bootstrap (nur Seed)
  SUPERADMIN_EMAIL: optional,
  SUPERADMIN_PASSWORD: optional,
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ungültige Umgebungskonfiguration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (!env.COOKIE_SECURE) throw new Error('COOKIE_SECURE muss in Produktion "true" sein.');
    if (env.NFC_SIMULATOR_ENABLED) {
      throw new Error('NFC_SIMULATOR_ENABLED darf in Produktion nicht aktiv sein.');
    }
    if (env.RATE_LIMIT_DISABLED) throw new Error('RATE_LIMIT_DISABLED darf in Produktion nicht aktiv sein.');
    if (/^0+$/.test(env.APP_ENCRYPTION_KEY)) throw new Error('APP_ENCRYPTION_KEY ist ein Platzhalter.');
  }
  if (env.QUEUE_DRIVER === 'bullmq' && !env.REDIS_URL) {
    throw new Error('QUEUE_DRIVER=bullmq benötigt REDIS_URL.');
  }
  return env;
}

export interface IntegrationStatus {
  stripe: boolean;
  smtp: boolean;
  appleWallet: boolean;
  googleWallet: boolean;
  nfcSimulator: boolean;
}

/** Ehrliche Auskunft darüber, welche externen Integrationen wirklich konfiguriert sind. */
export function integrationStatus(env: Env): IntegrationStatus {
  return {
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    smtp: Boolean(env.SMTP_URL || env.SMTP_HOST),
    appleWallet: Boolean(
      env.APPLE_PASS_TYPE_ID && env.APPLE_TEAM_ID && env.APPLE_PASS_CERT_PEM && env.APPLE_PASS_KEY_PEM && env.APPLE_WWDR_CERT_PEM,
    ),
    googleWallet: Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SA_EMAIL && env.GOOGLE_WALLET_SA_PRIVATE_KEY),
    nfcSimulator: env.NFC_SIMULATOR_ENABLED,
  };
}
