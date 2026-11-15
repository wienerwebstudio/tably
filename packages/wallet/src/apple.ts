import { createHash } from 'node:crypto';
import forge from 'node-forge';
import { createZip } from './zip';
import { renderIcon, renderStampStrip, rgbCss } from './png';
import type { WalletCardModel } from './model';

export interface ApplePassConfig {
  passTypeIdentifier: string;
  teamIdentifier: string;
  /** PEM des Pass-Type-ID-Zertifikats */
  certificatePem: string;
  /** PEM des zugehörigen privaten Schlüssels */
  privateKeyPem: string;
  privateKeyPassphrase?: string;
  /** PEM des Apple-WWDR-Zwischenzertifikats (G4) */
  wwdrPem: string;
  /** Basis-URL des Pass-Webservice, z. B. https://api.example.com/wallet/apple */
  webServiceUrl?: string;
}

export interface ApplePassInput {
  card: WalletCardModel;
  /** Token, mit dem sich das Gerät am Webservice authentifiziert (mind. 16 Zeichen) */
  authenticationToken: string;
}

export function buildPassJson(config: ApplePassConfig, input: ApplePassInput): Record<string, unknown> {
  const { card } = input;
  const backFields: Array<Record<string, unknown>> = [
    { key: 'customer', label: 'Karteninhaber:in', value: card.customerName },
    { key: 'code', label: 'Kartencode', value: card.shortCode },
    {
      key: 'link',
      label: 'Karte im Browser öffnen',
      value: card.cardUrl,
      attributedValue: `<a href="${card.cardUrl}">Karte öffnen</a>`,
    },
  ];
  if (card.message) {
    backFields.unshift({
      key: 'message',
      label: 'Aktuell',
      value: card.message,
      changeMessage: '%@',
    });
  }
  if (card.description) backFields.push({ key: 'about', label: card.programName, value: card.description });
  if (card.terms) backFields.push({ key: 'terms', label: 'Bedingungen', value: card.terms });

  const pass: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    serialNumber: card.serial,
    organizationName: card.organizationName,
    description: `${card.cardTitle} – ${card.organizationName}`,
    logoText: card.organizationName,
    backgroundColor: rgbCss(card.backgroundColor),
    foregroundColor: rgbCss(card.textColor),
    labelColor: rgbCss(card.accentColor),
    sharingProhibited: true,
    storeCard: {
      headerFields: [
        {
          key: 'balance',
          label: card.unitLabel.toUpperCase(),
          value: `${card.balance} / ${card.stampsRequired}`,
          changeMessage: 'Neuer Stand: %@',
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      secondaryFields: [
        { key: 'title', label: 'KARTE', value: card.cardTitle },
        {
          key: 'reward',
          label: 'PRÄMIE',
          value:
            card.rewardsAvailable > 0
              ? `${card.rewardsAvailable}× ${card.rewardName} einlösbar`
              : card.rewardName,
          changeMessage: '%@',
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      backFields,
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: card.shortCode,
        messageEncoding: 'iso-8859-1',
        altText: card.shortCode,
      },
    ],
  };
  if (config.webServiceUrl) {
    pass.webServiceURL = config.webServiceUrl;
    pass.authenticationToken = input.authenticationToken;
  }
  if (card.expiresAt) pass.expirationDate = card.expiresAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return pass;
}

export function buildPassFiles(config: ApplePassConfig, input: ApplePassInput): Map<string, Buffer> {
  const { card } = input;
  const files = new Map<string, Buffer>();
  files.set('pass.json', Buffer.from(JSON.stringify(buildPassJson(config, input)), 'utf8'));
  files.set('icon.png', renderIcon(29, card.backgroundColor, card.accentColor));
  files.set('icon@2x.png', renderIcon(58, card.backgroundColor, card.accentColor));
  files.set('icon@3x.png', renderIcon(87, card.backgroundColor, card.accentColor));
  if (card.logoPng) files.set('logo@2x.png', card.logoPng);
  const strip = (scale: number) =>
    renderStampStrip({
      width: 375 * scale,
      height: 123 * scale,
      total: card.stampsRequired,
      filled: Math.min(card.balance, card.stampsRequired),
      backgroundHex: card.backgroundColor,
      accentHex: card.accentColor,
      textHex: card.textColor,
    });
  files.set('strip.png', strip(1));
  files.set('strip@2x.png', strip(2));
  return files;
}

export function buildManifest(files: Map<string, Buffer>): Buffer {
  const manifest: Record<string, string> = {};
  for (const [name, data] of files) manifest[name] = createHash('sha1').update(data).digest('hex');
  return Buffer.from(JSON.stringify(manifest), 'utf8');
}

/** Abgesetzte PKCS#7-Signatur über manifest.json (DER). */
export function signManifest(config: ApplePassConfig, manifest: Buffer): Buffer {
  const certificate = forge.pki.certificateFromPem(config.certificatePem);
  const wwdr = forge.pki.certificateFromPem(config.wwdrPem);
  const key = config.privateKeyPassphrase
    ? forge.pki.decryptRsaPrivateKey(config.privateKeyPem, config.privateKeyPassphrase)
    : forge.pki.privateKeyFromPem(config.privateKeyPem);
  if (!key) throw new Error('Privater Schlüssel des Pass-Zertifikats konnte nicht gelesen werden.');

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString('binary'));
  p7.addCertificate(certificate);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
      { type: forge.pki.oids.messageDigest! },
      { type: forge.pki.oids.signingTime!, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

/** Erzeugt ein vollständiges, signiertes .pkpass-Archiv. */
export function createPkpass(config: ApplePassConfig, input: ApplePassInput): Buffer {
  if (input.authenticationToken.length < 16) throw new Error('authenticationToken muss mindestens 16 Zeichen haben.');
  const files = buildPassFiles(config, input);
  const manifest = buildManifest(files);
  const signature = signManifest(config, manifest);
  return createZip([
    ...[...files].map(([name, data]) => ({ name, data })),
    { name: 'manifest.json', data: manifest },
    { name: 'signature', data: signature },
  ]);
}

export const PKPASS_MIME = 'application/vnd.apple.pkpass';
