/**
 * Hilfen für die Personalisierung eines NTAG 424 DNA.
 *
 * Tably schreibt keine Chips selbst (dafür ist ein NFC-Schreibgerät nötig),
 * liefert aber exakt die Werte, die in ein Personalisierungswerkzeug
 * (z. B. NXP TagXplorer oder eine eigene Fertigungsstation) eingetragen werden.
 */

export interface PersonalizationInput {
  /** Basis-URL der Kunden-Website, z. B. https://tably.example */
  webUrl: string;
  /** Öffentliche Gerätekennung */
  publicId: string;
}

export interface PersonalizationProfile {
  /** URL-Vorlage mit Platzhaltern, wie sie in die NDEF-Datei geschrieben wird */
  urlTemplate: string;
  /** NDEF-Nutzdaten ohne Schema (URI-Präfixcode 0x04 = https://) */
  ndefUriPayload: string;
  uriPrefixCode: number;
  /** Offset der verschlüsselten PICCData innerhalb der NDEF-Datei (Datei 02) */
  piccDataOffset: number;
  /** Offset des SDMMAC innerhalb der NDEF-Datei */
  sdmMacOffset: number;
  /** = sdmMacOffset → leerer MAC-Eingang */
  sdmMacInputOffset: number;
  settings: {
    sdmEnabled: true;
    uidMirroring: true;
    readCounterMirroring: true;
    piccDataEncrypted: true;
    /** Schlüsselnummer für SDMMetaRead */
    sdmMetaReadKeyNo: 1;
    /** Schlüsselnummer für SDMFileRead */
    sdmFileReadKeyNo: 2;
    /** Zählerabruf nur authentifiziert */
    sdmCtrRetKeyNo: 1;
  };
}

const PICC_PLACEHOLDER = '0'.repeat(32);
const MAC_PLACEHOLDER = '0'.repeat(16);

/**
 * NDEF-Datei: 2 Byte NLEN, danach die NDEF-Nachricht. Für einen kurzen
 * URI-Record (SR=1): Header D1, Type Length 01, Payload Length, Type 'U',
 * Präfixcode → die URL-Nutzdaten beginnen bei Offset 7.
 */
const NDEF_URI_PAYLOAD_OFFSET = 7;

export function buildPersonalizationProfile(input: PersonalizationInput): PersonalizationProfile {
  const base = input.webUrl.replace(/\/+$/, '');
  if (!base.startsWith('https://')) {
    throw new Error('NFC-URLs müssen https:// verwenden (iOS öffnet nur Universal-/HTTPS-Links zuverlässig).');
  }
  const urlTemplate = `${base}/t/${input.publicId}?e=${PICC_PLACEHOLDER}&c=${MAC_PLACEHOLDER}`;
  const ndefUriPayload = urlTemplate.slice('https://'.length);
  if (ndefUriPayload.length + 1 > 255) throw new Error('URL zu lang für einen kurzen NDEF-Record.');
  const piccDataOffset = NDEF_URI_PAYLOAD_OFFSET + ndefUriPayload.indexOf(`e=${PICC_PLACEHOLDER}`) + 2;
  const sdmMacOffset = NDEF_URI_PAYLOAD_OFFSET + ndefUriPayload.indexOf(`c=${MAC_PLACEHOLDER}`) + 2;
  return {
    urlTemplate,
    ndefUriPayload,
    uriPrefixCode: 0x04,
    piccDataOffset,
    sdmMacOffset,
    sdmMacInputOffset: sdmMacOffset,
    settings: {
      sdmEnabled: true,
      uidMirroring: true,
      readCounterMirroring: true,
      piccDataEncrypted: true,
      sdmMetaReadKeyNo: 1,
      sdmFileReadKeyNo: 2,
      sdmCtrRetKeyNo: 1,
    },
  };
}

export function buildTapUrl(webUrl: string, publicId: string, piccDataHex: string, macHex: string): string {
  return `${webUrl.replace(/\/+$/, '')}/t/${publicId}?e=${piccDataHex}&c=${macHex}`;
}
