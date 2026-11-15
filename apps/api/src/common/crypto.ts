import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env';

/** Zufälliges, URL-sicheres Token (Standard: 256 Bit). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens werden nie im Klartext gespeichert, nur ihr SHA-256. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function appKey(): Buffer {
  return Buffer.from(getEnv().APP_ENCRYPTION_KEY, 'hex');
}

/** AES-256-GCM für ruhende Geheimnisse. Format: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(plain: Buffer | string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', appKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): Buffer {
  const [version, iv, tag, enc] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !enc) throw new Error('Unbekanntes Geheimnisformat');
  const decipher = createDecipheriv('aes-256-gcm', appKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64url')), decipher.final()]);
}

/** HMAC mit dem Anwendungsschlüssel – für kurze Codes, die nicht per Rainbow-Table umkehrbar sein sollen. */
export function keyedHash(scope: string, value: string): string {
  return createHmac('sha256', appKey()).update(`${scope}:${value}`).digest('hex');
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // ohne 0/O/1/I

/** Kartencode wie „K7F3-92QX“. */
export function randomShortCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(randomInt(10));
  return out;
}

export function randomId(prefix: string, bytes = 9): string {
  return `${prefix}_${randomBytes(bytes).toString('base64url').replace(/[-_]/g, 'x')}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ── TOTP (RFC 6238, SHA-1, 30 s, 6 Stellen) ─────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secretBase32: string, timeMs: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30_000)));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export function verifyTotp(secretBase32: string, code: string, timeMs: number = Date.now()): boolean {
  for (const drift of [-1, 0, 1]) {
    if (safeEqual(totpCode(secretBase32, timeMs + drift * 30_000), code)) return true;
  }
  return false;
}
