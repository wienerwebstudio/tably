import { describe, expect, it } from 'vitest';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import forge from 'node-forge';
import { createPkpass, buildPassJson, type ApplePassConfig } from './apple';
import { buildLoyaltyObject, createSaveUrl, GoogleWalletClient, type GoogleWalletConfig } from './google';
import { Canvas, renderStampStrip } from './png';
import type { WalletCardModel } from './model';

const card: WalletCardModel = {
  serial: 'ser_0123456789abcdef',
  shortCode: 'K7F3-92QX',
  organizationName: 'Café Morgenrot',
  programName: 'Kaffeekarte',
  cardTitle: 'Kaffeekarte',
  description: 'Jeder 10. Kaffee geht aufs Haus.',
  customerName: 'Lena',
  balance: 4,
  stampsRequired: 10,
  rewardsAvailable: 0,
  rewardName: 'Gratis Kaffee',
  unitLabel: 'Stempel',
  backgroundColor: '#1F3A2E',
  textColor: '#FFFFFF',
  accentColor: '#E8B86D',
  cardUrl: 'https://tably.example/c/abc',
  terms: 'Nicht mit anderen Aktionen kombinierbar.',
  logoUrl: 'https://tably.example/logo.png',
};

/** Selbstsigniertes Testzertifikat – ersetzt für die Strukturprüfung Pass-Zertifikat und WWDR. */
function selfSigned(): { certPem: string; keyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000 * 30);
  const attrs = [{ name: 'commonName', value: 'Pass Type ID: pass.test.tably' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { certPem: forge.pki.certificateToPem(cert), keyPem: forge.pki.privateKeyToPem(keys.privateKey) };
}

function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let off = 0;
  while (buf.readUInt32LE(off) === 0x04034b50) {
    const size = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString('utf8');
    const start = off + 30 + nameLen + extraLen;
    out.set(name, buf.subarray(start, start + size));
    off = start + size;
  }
  return out;
}

describe('Apple Wallet – .pkpass', () => {
  const { certPem, keyPem } = selfSigned();
  const config: ApplePassConfig = {
    passTypeIdentifier: 'pass.test.tably',
    teamIdentifier: 'TEAM123456',
    certificatePem: certPem,
    privateKeyPem: keyPem,
    wwdrPem: certPem,
    webServiceUrl: 'https://api.tably.example/wallet/apple',
  };
  const pkpass = createPkpass(config, { card, authenticationToken: 'a'.repeat(32) });
  const files = readZip(pkpass);

  it('enthält alle Pflichtdateien', () => {
    for (const f of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'strip.png']) {
      expect(files.has(f), f).toBe(true);
    }
  });

  it('ist ein Archiv, das Standardwerkzeuge lesen können', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkpass-'));
    writeFileSync(join(dir, 'card.pkpass'), pkpass);
    const listing = execFileSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(",".join(z.namelist()))`, join(dir, 'card.pkpass')]).toString();
    expect(listing).toContain('pass.json');
  });

  it('manifest.json enthält korrekte SHA-1-Hashes aller Dateien', () => {
    const manifest = JSON.parse(files.get('manifest.json')!.toString()) as Record<string, string>;
    const names = [...files.keys()].filter((n) => n !== 'manifest.json' && n !== 'signature').sort();
    expect(Object.keys(manifest).sort()).toEqual(names);
    for (const n of names) expect(manifest[n]).toBe(createHash('sha1').update(files.get(n)!).digest('hex'));
  });

  it('pass.json beschreibt eine storeCard mit Webservice', () => {
    const pass = JSON.parse(files.get('pass.json')!.toString());
    expect(pass.passTypeIdentifier).toBe('pass.test.tably');
    expect(pass.serialNumber).toBe(card.serial);
    expect(pass.storeCard.headerFields[0].value).toBe('4 / 10');
    expect(pass.webServiceURL).toBe(config.webServiceUrl);
    expect(pass.authenticationToken).toHaveLength(32);
    expect(pass.backgroundColor).toBe('rgb(31, 58, 46)');
  });

  it('die PKCS#7-Signatur lässt sich mit OpenSSL gegen das Manifest prüfen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkpass-'));
    writeFileSync(join(dir, 'signature'), files.get('signature')!);
    writeFileSync(join(dir, 'manifest.json'), files.get('manifest.json')!);
    writeFileSync(join(dir, 'ca.pem'), certPem);
    const out = execFileSync(
      'openssl',
      ['smime', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 'signature'), '-content', join(dir, 'manifest.json'), '-CAfile', join(dir, 'ca.pem'), '-purpose', 'any', '-out', join(dir, 'verified.json')],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    expect(out).toBeDefined();
    expect(readFileSync(join(dir, 'verified.json')).equals(files.get('manifest.json')!)).toBe(true);
  });

  it('zeigt einlösbare Prämien an', () => {
    const json = buildPassJson(config, { card: { ...card, balance: 10, rewardsAvailable: 1 }, authenticationToken: 'b'.repeat(32) }) as any;
    expect(json.storeCard.secondaryFields[1].value).toBe('1× Gratis Kaffee einlösbar');
  });
});

describe('PNG-Erzeugung', () => {
  it('erzeugt gültige PNG-Dateien', () => {
    const png = renderStampStrip({ width: 375, height: 123, total: 10, filled: 4, backgroundHex: '#1F3A2E', accentHex: '#E8B86D', textHex: '#FFFFFF' });
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(375);
    expect(png.readUInt32BE(20)).toBe(123);
    const dir = mkdtempSync(join(tmpdir(), 'png-'));
    writeFileSync(join(dir, 's.png'), png);
    const info = execFileSync('python3', ['-c', `import zlib,struct,sys;d=open(sys.argv[1],'rb').read();p=8;idat=b''\nwhile p<len(d):\n l,=struct.unpack('>I',d[p:p+4]);t=d[p+4:p+8];c=d[p+8:p+8+l];assert zlib.crc32(t+c)==struct.unpack('>I',d[p+8+l:p+12+l])[0]\n if t==b'IDAT': idat+=c\n p+=12+l\nprint(len(zlib.decompress(idat)))`, join(dir, 's.png')]).toString().trim();
    expect(Number(info)).toBe((375 * 4 + 1) * 123);
  });
  it('füllt Flächen deckend', () => {
    const c = new Canvas(4, 4).fill({ r: 1, g: 2, b: 3 });
    expect([...c.data.subarray(0, 4)]).toEqual([1, 2, 3, 255]);
  });
});

describe('Google Wallet', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config: GoogleWalletConfig = {
    issuerId: '3388000000012345678',
    serviceAccountEmail: 'wallet@tably-test.iam.gserviceaccount.com',
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  it('erzeugt einen korrekt signierten Save-Link', () => {
    const url = createSaveUrl(config, 'prog_1', card, ['https://tably.example'], 1_800_000_000);
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    const [h, p, s] = url.split('/save/')[1]!.split('.');
    expect(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s!, 'base64url'))).toBe(true);
    const payload = JSON.parse(Buffer.from(p!, 'base64url').toString());
    expect(payload).toMatchObject({ iss: config.serviceAccountEmail, aud: 'google', typ: 'savetowallet', iat: 1_800_000_000 });
    expect(payload.payload.loyaltyObjects[0].id).toBe('3388000000012345678.card_ser_0123456789abcdef');
    expect(payload.payload.loyaltyObjects[0].classId).toBe(payload.payload.loyaltyClasses[0].id);
  });

  it('bildet den Kartenstand im Objekt ab', () => {
    const obj = buildLoyaltyObject(config, 'prog_1', card) as any;
    expect(obj.loyaltyPoints.balance.string).toBe('4 / 10');
    expect(obj.barcode.value).toBe('K7F3-92QX');
  });

  it('aktualisiert Objekte über die REST-API (mit Token-Cache)', async () => {
    const calls: Array<{ url: string; method?: string; auth?: string }> = [];
    const client = new GoogleWalletClient(config, async (url, init) => {
      calls.push({ url, method: init?.method, auth: init?.headers?.authorization });
      if (url.includes('oauth2')) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'tok', expires_in: 3600 }) };
      if (url.includes('missing')) return { ok: false, status: 404, text: async () => '{}' };
      return { ok: true, status: 200, text: async () => '{}' };
    });
    expect(await client.updateObject('prog_1', card)).toBe(true);
    expect(await client.updateObject('prog_1', { ...card, serial: 'missing' })).toBe(false);
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    expect(calls[1]).toMatchObject({ method: 'PATCH', auth: 'Bearer tok' });
  });
});
