import { createHash, createPublicKey, verify as cryptoVerify, sign as cryptoSign, type KeyObject } from 'node:crypto';

/**
 * Protokoll für aktive Stempel (Ausbaustufe B).
 *
 * Ein aktiver Stempel besitzt einen eigenen Reader, eine sichere Geräteidentität
 * (Ed25519-Schlüsselpaar, privater Schlüssel im Secure Element) und meldet
 * gelesene Kundenkennungen per HTTPS an das Backend. Jede Anfrage ist signiert:
 *
 *   X-Tably-Device:    <publicId>
 *   X-Tably-Timestamp: <Unix-Sekunden>
 *   X-Tably-Nonce:     <mind. 16 zufällige Zeichen>
 *   X-Tably-Signature: base64( Ed25519( kanonischer String ) )
 *
 *   kanonischer String = "TABLY-DEVICE-V1\n" + publicId + "\n" + timestamp + "\n"
 *                        + nonce + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
 *
 * Das Backend prüft Signatur, Zeitfenster (±90 s) und Einmaligkeit der Nonce.
 * Das Auslesen von Apple-Wallet- bzw. Google-Wallet-Pässen per NFC (Apple VAS,
 * Google Smart Tap) ist NICHT Teil dieses Pakets: dafür sind Freigaben von
 * Apple/Google und geeignete Reader-Hardware erforderlich (siehe docs).
 */

export const DEVICE_SIGNATURE_VERSION = 'TABLY-DEVICE-V1';
export const DEVICE_CLOCK_SKEW_SECONDS = 90;

export interface SignedDeviceRequest {
  publicId: string;
  timestamp: number;
  nonce: string;
  method: string;
  path: string;
  body: string;
}

export function canonicalDeviceString(req: SignedDeviceRequest): string {
  const bodyHash = createHash('sha256').update(req.body).digest('hex');
  return [
    DEVICE_SIGNATURE_VERSION,
    req.publicId,
    String(req.timestamp),
    req.nonce,
    req.method.toUpperCase(),
    req.path,
    bodyHash,
  ].join('\n');
}

export function signDeviceRequest(privateKey: KeyObject, req: SignedDeviceRequest): string {
  return cryptoSign(null, Buffer.from(canonicalDeviceString(req)), privateKey).toString('base64');
}

export type DeviceSignatureRejection = 'bad_key' | 'clock_skew' | 'bad_nonce' | 'bad_signature';

export function verifyDeviceRequest(
  publicKeyBase64: string,
  req: SignedDeviceRequest,
  signatureBase64: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): { ok: true } | { ok: false; reason: DeviceSignatureRejection } {
  if (Math.abs(nowSeconds - req.timestamp) > DEVICE_CLOCK_SKEW_SECONDS) return { ok: false, reason: 'clock_skew' };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(req.nonce)) return { ok: false, reason: 'bad_nonce' };
  let key: KeyObject;
  try {
    key = createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
  } catch {
    return { ok: false, reason: 'bad_key' };
  }
  let valid = false;
  try {
    valid = cryptoVerify(null, Buffer.from(canonicalDeviceString(req)), key, Buffer.from(signatureBase64, 'base64'));
  } catch {
    valid = false;
  }
  return valid ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

/** Was ein aktiver Stempel pro Lesevorgang meldet. */
export interface ActiveReaderTapReport {
  /** Vom Reader gelesene Kartenkennung (Kurzcode oder Seriennummer der Tably-Karte) */
  cardIdentifier: string;
  /** Wie die Kennung gelesen wurde */
  channel: 'qr' | 'nfc_hce' | 'apple_vas' | 'google_smart_tap';
  /** Fortlaufende Nummer des Geräts – schützt zusätzlich vor Wiederholungen */
  sequence: number;
  firmware?: string;
  batteryPercent?: number;
}
