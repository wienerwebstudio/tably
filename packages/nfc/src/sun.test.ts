import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { aesCmac } from './cmac';
import { computeSdmMac, decryptPiccData, deriveSessionMacKey, generateSun, verifySun } from './sun';
import { buildPersonalizationProfile } from './personalization';
import { signDeviceRequest, verifyDeviceRequest } from './active';

const hex = (s: string) => Buffer.from(s.replace(/\s/g, ''), 'hex');

describe('AES-CMAC (RFC 4493 Testvektoren)', () => {
  const key = hex('2b7e151628aed2a6abf7158809cf4f3c');
  it('leere Nachricht', () => {
    expect(aesCmac(key, Buffer.alloc(0)).toString('hex')).toBe('bb1d6929e95937287fa37d129b756746');
  });
  it('16 Byte', () => {
    expect(aesCmac(key, hex('6bc1bee22e409f96e93d7e117393172a')).toString('hex')).toBe(
      '070a16b46b4d4144f79bdd9dd04a287c',
    );
  });
  it('40 Byte', () => {
    const m = hex('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411');
    expect(aesCmac(key, m).toString('hex')).toBe('dfa66747de9ae63030ca32611497c827');
  });
  it('64 Byte', () => {
    const m = hex(
      '6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710',
    );
    expect(aesCmac(key, m).toString('hex')).toBe('51f0bebf7e3b9d92fc49741779363cfe');
  });
});

describe('SUN – NXP AN12196 Testvektor', () => {
  // https://choose.url.com/ntag424?e=EF963FF7828658A599F3041510671E88&c=94EED9EE65337086
  const zero = Buffer.alloc(16);
  const e = 'EF963FF7828658A599F3041510671E88';
  const c = '94EED9EE65337086';

  it('entschlüsselt PICCData', () => {
    expect(decryptPiccData(zero, e)).toEqual({ uidHex: '04DE5F1EACC040', counter: 61 });
  });
  it('leitet den Sitzungsschlüssel ab und berechnet den SDMMAC', () => {
    const session = deriveSessionMacKey(zero, '04DE5F1EACC040', 61);
    expect(session.toString('hex').toUpperCase()).toBe('3FB5F6E3A807A03D5E3570ACE393776F');
    expect(computeSdmMac(session).toString('hex').toUpperCase()).toBe(c);
  });
  it('verifiziert den vollständigen Nachweis', () => {
    expect(verifySun({ metaKey: zero, fileKey: zero, piccDataHex: e, macHex: c })).toEqual({
      ok: true,
      uidHex: '04DE5F1EACC040',
      counter: 61,
    });
  });
});

describe('SUN – Ablehnungen', () => {
  const keys = { metaKey: randomBytes(16), fileKey: randomBytes(16) };
  const good = generateSun({ ...keys, uidHex: '04A1B2C3D4E5F6', counter: 7 });

  it('akzeptiert selbst erzeugte Nachweise', () => {
    expect(verifySun({ ...keys, piccDataHex: good.piccDataHex, macHex: good.macHex })).toEqual({
      ok: true,
      uidHex: '04A1B2C3D4E5F6',
      counter: 7,
    });
  });
  it('lehnt manipulierten MAC ab', () => {
    const mac = (good.macHex[0] === '0' ? '1' : '0') + good.macHex.slice(1);
    expect(verifySun({ ...keys, piccDataHex: good.piccDataHex, macHex: mac })).toEqual({ ok: false, reason: 'mac_invalid' });
  });
  it('lehnt manipulierte PICCData ab', () => {
    const e = (good.piccDataHex[0] === '0' ? '1' : '0') + good.piccDataHex.slice(1);
    expect(verifySun({ ...keys, piccDataHex: e, macHex: good.macHex }).ok).toBe(false);
  });
  it('lehnt fremde Schlüssel ab', () => {
    const r = verifySun({ metaKey: keys.metaKey, fileKey: randomBytes(16), piccDataHex: good.piccDataHex, macHex: good.macHex });
    expect(r).toEqual({ ok: false, reason: 'mac_invalid' });
  });
  it('lehnt fehlerhafte Formate ab', () => {
    expect(verifySun({ ...keys, piccDataHex: 'xyz', macHex: good.macHex })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifySun({ ...keys, piccDataHex: good.piccDataHex, macHex: '12' })).toEqual({ ok: false, reason: 'malformed' });
  });
  it('MAC hängt vom Zähler ab (kein Wiederverwenden für andere Zählerstände)', () => {
    const next = generateSun({ ...keys, uidHex: '04A1B2C3D4E5F6', counter: 8 });
    expect(next.macHex).not.toBe(good.macHex);
    expect(verifySun({ ...keys, piccDataHex: next.piccDataHex, macHex: good.macHex }).ok).toBe(false);
  });
});

describe('Personalisierungsprofil', () => {
  it('berechnet Offsets passend zur URL-Vorlage', () => {
    const p = buildPersonalizationProfile({ webUrl: 'https://tably.example', publicId: 'st_abc123' });
    expect(p.urlTemplate).toBe(`https://tably.example/t/st_abc123?e=${'0'.repeat(32)}&c=${'0'.repeat(16)}`);
    // Offset 7 = Beginn der URI-Nutzdaten in der NDEF-Datei
    expect(p.ndefUriPayload.slice(p.piccDataOffset - 7, p.piccDataOffset - 7 + 32)).toBe('0'.repeat(32));
    expect(p.ndefUriPayload.slice(p.sdmMacOffset - 7 - 2, p.sdmMacOffset - 7)).toBe('c=');
    expect(p.sdmMacInputOffset).toBe(p.sdmMacOffset);
  });
  it('verlangt https', () => {
    expect(() => buildPersonalizationProfile({ webUrl: 'http://x.test', publicId: 'a' })).toThrow();
  });
});

describe('Signierte Geräteanfragen (aktiver Stempel)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const req = { publicId: 'st_1', timestamp: 1_800_000_000, nonce: 'abcdefghijklmnop', method: 'POST', path: '/v1/devices/taps', body: '{"a":1}' };
  const sig = signDeviceRequest(privateKey, req);

  it('akzeptiert gültige Signatur', () => {
    expect(verifyDeviceRequest(pub, req, sig, req.timestamp + 5)).toEqual({ ok: true });
  });
  it('lehnt veränderten Body ab', () => {
    expect(verifyDeviceRequest(pub, { ...req, body: '{"a":2}' }, sig, req.timestamp)).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('lehnt alte Anfragen ab', () => {
    expect(verifyDeviceRequest(pub, req, sig, req.timestamp + 600)).toEqual({ ok: false, reason: 'clock_skew' });
  });
});
