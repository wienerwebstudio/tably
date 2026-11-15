import { createSign } from 'node:crypto';
import type { WalletCardModel } from './model';

export interface GoogleWalletConfig {
  issuerId: string;
  serviceAccountEmail: string;
  /** PEM (PKCS#8) des Dienstkonto-Schlüssels */
  privateKeyPem: string;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function signJwt(header: object, payload: object, privateKeyPem: string): string {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${b64url(signature)}`;
}

/** Google erlaubt in IDs nur alphanumerische Zeichen sowie . _ - */
export function sanitizeIdSuffix(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function classId(config: GoogleWalletConfig, programId: string): string {
  return `${config.issuerId}.tably_${sanitizeIdSuffix(programId)}`;
}

export function objectId(config: GoogleWalletConfig, serial: string): string {
  return `${config.issuerId}.card_${sanitizeIdSuffix(serial)}`;
}

export function buildLoyaltyClass(config: GoogleWalletConfig, programId: string, card: WalletCardModel): Record<string, unknown> {
  if (!card.logoUrl) throw new Error('Google Wallet benötigt eine öffentlich erreichbare Logo-URL.');
  return {
    id: classId(config, programId),
    issuerName: card.organizationName,
    programName: card.cardTitle,
    programLogo: {
      sourceUri: { uri: card.logoUrl },
      contentDescription: { defaultValue: { language: 'de', value: `${card.organizationName} Logo` } },
    },
    hexBackgroundColor: card.backgroundColor,
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'DE',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
  };
}

export function buildLoyaltyObject(config: GoogleWalletConfig, programId: string, card: WalletCardModel): Record<string, unknown> {
  const textModules: Array<Record<string, string>> = [
    {
      id: 'reward',
      header: 'Prämie',
      body: card.rewardsAvailable > 0 ? `${card.rewardsAvailable}× ${card.rewardName} einlösbar` : card.rewardName,
    },
  ];
  if (card.message) textModules.push({ id: 'message', header: 'Aktuell', body: card.message });
  if (card.terms) textModules.push({ id: 'terms', header: 'Bedingungen', body: card.terms });
  const object: Record<string, unknown> = {
    id: objectId(config, card.serial),
    classId: classId(config, programId),
    state: 'ACTIVE',
    accountId: card.shortCode,
    accountName: card.customerName,
    loyaltyPoints: {
      label: card.unitLabel,
      balance: { string: `${card.balance} / ${card.stampsRequired}` },
    },
    barcode: { type: 'QR_CODE', value: card.shortCode, alternateText: card.shortCode },
    textModulesData: textModules,
    linksModuleData: { uris: [{ id: 'card', uri: card.cardUrl, description: 'Karte im Browser öffnen' }] },
  };
  if (card.expiresAt) object.validTimeInterval = { end: { date: card.expiresAt.toISOString() } };
  return object;
}

/**
 * „Add to Google Wallet“-Link. Klasse und Objekt stecken im signierten JWT –
 * Google legt beides beim Speichern an, ein vorheriger REST-Aufruf ist nicht nötig.
 */
export function createSaveUrl(
  config: GoogleWalletConfig,
  programId: string,
  card: WalletCardModel,
  origins: string[] = [],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const jwt = signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: config.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: nowSeconds,
      origins,
      payload: {
        loyaltyClasses: [buildLoyaltyClass(config, programId, card)],
        loyaltyObjects: [buildLoyaltyObject(config, programId, card)],
      },
    },
    config.privateKeyPem,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export class GoogleWalletError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Schlanker REST-Client für Aktualisierungen bestehender Objekte. */
export class GoogleWalletClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: GoogleWalletConfig,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expiresAt - 60 > now) return this.token.value;
    const assertion = signJwt(
      { alg: 'RS256', typ: 'JWT' },
      { iss: this.config.serviceAccountEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
      this.config.privateKeyPem,
    );
    const res = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    const text = await res.text();
    if (!res.ok) throw new GoogleWalletError(res.status, `Token-Anfrage fehlgeschlagen: ${text.slice(0, 300)}`);
    const json = JSON.parse(text) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: now + json.expires_in };
    return json.access_token;
  }

  private async request(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(`${API_BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok && res.status !== 404) throw new GoogleWalletError(res.status, text.slice(0, 500));
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  /** Aktualisiert Stand und Texte eines gespeicherten Objekts. Gibt false zurück, wenn es (noch) nicht existiert. */
  async updateObject(programId: string, card: WalletCardModel): Promise<boolean> {
    const id = objectId(this.config, card.serial);
    const object = buildLoyaltyObject(this.config, programId, card);
    const res = await this.request('PATCH', `/loyaltyObject/${encodeURIComponent(id)}`, object);
    return res.status !== 404;
  }

  /** Aktualisiert die Klasse (Design/Name) nach Änderungen am Programm. */
  async updateClass(programId: string, card: WalletCardModel): Promise<boolean> {
    const id = classId(this.config, programId);
    const res = await this.request('PATCH', `/loyaltyClass/${encodeURIComponent(id)}`, buildLoyaltyClass(this.config, programId, card));
    return res.status !== 404;
  }

  /** Mitteilung am Objekt; Google begrenzt sichtbare Benachrichtigungen (siehe docs). */
  async addMessage(serial: string, header: string, body: string, notify: boolean): Promise<boolean> {
    const id = objectId(this.config, serial);
    const res = await this.request('POST', `/loyaltyObject/${encodeURIComponent(id)}/addMessage`, {
      message: { header, body, messageType: notify ? 'TEXT_AND_NOTIFY' : 'TEXT' },
    });
    return res.status !== 404;
  }
}
