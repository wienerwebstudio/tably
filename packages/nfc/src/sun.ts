import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { aesCmac } from './cmac';

/**
 * Secure Unique NFC (SUN) / Secure Dynamic Messaging (SDM) des NXP NTAG 424 DNA.
 *
 * Bei jedem Lesevorgang spiegelt der Chip in die NDEF-URL:
 *   - `e` – PICCData, AES-128-CBC-verschlüsselt (IV = 0) mit dem SDMMetaReadKey.
 *           Klartext: Tag-Byte | UID (7) | SDMReadCtr (3, LSB first) | Zufall
 *   - `c` – SDMMAC, gekürzter AES-CMAC mit einem aus SDMFileReadKey, UID und
 *           Zähler abgeleiteten Sitzungsschlüssel.
 *
 * Referenz: NXP AN12196 „NTAG 424 DNA and NTAG 424 DNA TagTamper features and hints“.
 * Die Implementierung ist gegen den dort veröffentlichten Testvektor geprüft
 * (siehe sun.test.ts).
 */

export const PICC_DATA_TAG_UID_AND_COUNTER = 0xc7;
const UID_LENGTH = 7;

export type SunRejection =
  | 'malformed'
  | 'picc_decrypt_failed'
  | 'unsupported_picc_format'
  | 'mac_invalid';

export interface SunData {
  uidHex: string;
  counter: number;
}

export type SunResult = ({ ok: true } & SunData) | { ok: false; reason: SunRejection };

export interface SunKeys {
  /** SDMMetaReadKey (16 Byte) */
  metaKey: Buffer;
  /** SDMFileReadKey (16 Byte) */
  fileKey: Buffer;
}

const HEX32 = /^[0-9a-fA-F]{32}$/;
const HEX16 = /^[0-9a-fA-F]{16}$/;

export function decryptPiccData(metaKey: Buffer, encHex: string): SunData | null {
  if (!HEX32.test(encHex)) return null;
  const decipher = createDecipheriv('aes-128-cbc', metaKey, Buffer.alloc(16));
  decipher.setAutoPadding(false);
  const plain = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  if (plain[0] !== PICC_DATA_TAG_UID_AND_COUNTER) return null;
  const uid = plain.subarray(1, 1 + UID_LENGTH);
  const counter = plain.readUIntLE(1 + UID_LENGTH, 3);
  return { uidHex: uid.toString('hex').toUpperCase(), counter };
}

/** Sitzungsschlüssel KSesSDMFileReadMAC = CMAC(SDMFileReadKey, SV2). */
export function deriveSessionMacKey(fileKey: Buffer, uidHex: string, counter: number): Buffer {
  const ctr = Buffer.alloc(3);
  ctr.writeUIntLE(counter, 0, 3);
  const sv2 = Buffer.concat([Buffer.from('3CC300010080', 'hex'), Buffer.from(uidHex, 'hex'), ctr]);
  return aesCmac(fileKey, sv2);
}

/** SDMMAC: jedes zweite Byte (Index 1, 3, …, 15) des vollen CMAC. */
export function computeSdmMac(sessionKey: Buffer, macInput: Buffer = Buffer.alloc(0)): Buffer {
  const full = aesCmac(sessionKey, macInput);
  const out = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) out[i] = full[i * 2 + 1]!;
  return out;
}

export interface VerifySunInput extends SunKeys {
  /** Parameter `e` der URL */
  piccDataHex: string;
  /** Parameter `c` der URL */
  macHex: string;
  /**
   * Zusätzlich MAC-geschützte Daten (zwischen SDMMACInputOffset und SDMMACOffset).
   * Tably-Stempel werden mit SDMMACInputOffset = SDMMACOffset personalisiert,
   * der MAC-Eingang ist damit leer.
   */
  macInput?: Buffer;
}

/**
 * Prüft einen SUN-Nachweis. Stellt sicher, dass die URL von einem Chip stammt,
 * der beide Schlüssel kennt. Der Replay-Schutz (Zähler streng monoton) ist
 * Aufgabe des Aufrufers, weil er den gespeicherten Zählerstand atomar
 * fortschreiben muss.
 */
export function verifySun(input: VerifySunInput): SunResult {
  if (!HEX32.test(input.piccDataHex) || !HEX16.test(input.macHex)) {
    return { ok: false, reason: 'malformed' };
  }
  let data: SunData | null;
  try {
    data = decryptPiccData(input.metaKey, input.piccDataHex);
  } catch {
    return { ok: false, reason: 'picc_decrypt_failed' };
  }
  if (!data) return { ok: false, reason: 'unsupported_picc_format' };

  const sessionKey = deriveSessionMacKey(input.fileKey, data.uidHex, data.counter);
  const expected = computeSdmMac(sessionKey, input.macInput);
  const provided = Buffer.from(input.macHex, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'mac_invalid' };
  }
  return { ok: true, ...data };
}

export interface GenerateSunInput extends SunKeys {
  uidHex: string;
  counter: number;
  /** Für deterministische Tests; sonst Zufall wie beim echten Chip */
  padding?: Buffer;
}

/**
 * Erzeugt die Parameter, die ein echter Chip in die URL spiegeln würde.
 * Wird vom Simulator und von Tests verwendet – der Verifikationspfad ist
 * identisch zu echter Hardware.
 */
export function generateSun(input: GenerateSunInput): { piccDataHex: string; macHex: string } {
  if (!/^[0-9a-fA-F]{14}$/.test(input.uidHex)) throw new Error('UID muss 7 Byte (14 Hex-Zeichen) lang sein');
  if (input.counter < 0 || input.counter > 0xffffff) throw new Error('Zähler außerhalb des 24-Bit-Bereichs');
  const plain = Buffer.alloc(16);
  plain[0] = PICC_DATA_TAG_UID_AND_COUNTER;
  Buffer.from(input.uidHex, 'hex').copy(plain, 1);
  plain.writeUIntLE(input.counter, 8, 3);
  (input.padding ?? randomBytes(5)).copy(plain, 11, 0, 5);
  const cipher = createCipheriv('aes-128-cbc', input.metaKey, Buffer.alloc(16));
  cipher.setAutoPadding(false);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const sessionKey = deriveSessionMacKey(input.fileKey, input.uidHex.toUpperCase(), input.counter);
  return {
    piccDataHex: enc.toString('hex').toUpperCase(),
    macHex: computeSdmMac(sessionKey).toString('hex').toUpperCase(),
  };
}

/** Maximaler Wert des 24-Bit-Lesezählers. Danach liefert der Chip keine SUN-Daten mehr. */
export const SDM_COUNTER_MAX = 0xffffff;
