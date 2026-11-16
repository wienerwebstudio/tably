import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { generateSun, signDeviceRequest } from '@tapperl/nfc';
import { Client, createApp, createProgram, createSimDevice, enrollCustomer, registerMerchant, resetDb, simulateTap, uniq, type Merchant, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createApp();
  await resetDb(t.prisma);
});
afterAll(() => t.close());

const tap = (client: Client, params: { deviceId: string; e: string; c: string }) => client.post('/public/taps', params);

/** Physischer Stempel: Schlüssel wie bei der Chip-Personalisierung abrufen und Chip-Antworten nachbilden. */
async function physicalDevice(m: Merchant, programId: string) {
  const created = await m.client.post('/devices', { name: 'Stempel Theke', kind: 'PASSIVE_NTAG424', programId });
  const id = created.body.device.id as string;
  const perso = await m.client.post(`/devices/${id}/personalization`);
  const keys = { metaKey: Buffer.from(perso.body.keys.sdmMetaReadKey, 'hex'), fileKey: Buffer.from(perso.body.keys.sdmFileReadKey, 'hex') };
  const uidHex = `04${randomBytes(6).toString('hex').toUpperCase()}`;
  const read = (counter: number, uid = uidHex) => {
    const sun = generateSun({ ...keys, uidHex: uid, counter });
    return { deviceId: perso.body.publicId as string, e: sun.piccDataHex, c: sun.macHex };
  };
  return { id, publicId: perso.body.publicId as string, read, uidHex, keys };
}

describe('Geräteverwaltung', () => {
  it('registriert einen physischen Stempel; Schlüsselabruf nur für Inhaber und protokolliert', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const created = await m.client.post('/devices', { name: 'Stempel 1', kind: 'PASSIVE_NTAG424', programId: p.id });
    expect(created.body.device).toMatchObject({ status: 'PENDING', kind: 'PASSIVE_NTAG424', uidHex: null, securityStatus: 'OK' });
    expect(JSON.stringify(created.body)).not.toMatch(/metaKey|fileKey/);
    const list = await m.client.get('/devices');
    expect(JSON.stringify(list.body)).not.toMatch(/KeyEnc/);

    const perso = await m.client.post(`/devices/${created.body.device.id}/personalization`);
    expect(perso.body.keys.sdmMetaReadKey).toMatch(/^[0-9A-F]{32}$/);
    expect(perso.body.keys.sdmFileReadKey).not.toBe(perso.body.keys.sdmMetaReadKey);
    expect(perso.body.warning).toContain('https');
    const stored = await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: created.body.device.id } });
    expect(stored.metaKeyEnc).toMatch(/^v1\./);
    expect(stored.metaKeyEnc).not.toContain(perso.body.keys.sdmMetaReadKey);
    const events = await t.prisma.nfcDeviceEvent.findMany({ where: { deviceId: created.body.device.id } });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['REGISTERED', 'KEYS_REVEALED']));
    expect((await m.client.put(`/devices/${created.body.device.id}/status`, { status: 'ACTIVE' })).status).toBe(409);
  });

  it('setzt Tariflimits für Geräte durch', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    await t.prisma.subscription.update({ where: { organizationId: m.organizationId }, data: { planId: 'starter' } });
    await createSimDevice(m, p.id);
    await createSimDevice(m, p.id);
    const third = await m.client.post('/devices', { name: 'Drei', kind: 'SIMULATED', programId: p.id });
    expect(third.status).toBe(402);
    expect(third.body.error).toMatchObject({ code: 'limit_reached', details: { limit: 2, current: 2 } });
  });
});

describe('Physischer Stempel (NTAG 424 DNA, SUN)', () => {
  it('erster gültiger Tap aktiviert und bindet die UID; danach wird gestempelt', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 10 });
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);

    const activation = await tap(c.client, d.read(1));
    expect(activation.body.status).toBe('device_activated');
    const device = await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } });
    expect(device).toMatchObject({ status: 'ACTIVE', uidHex: d.uidHex, lastCounter: 1 });

    const first = await tap(c.client, d.read(2));
    expect(first.body).toMatchObject({ status: 'completed', amount: 1, card: { balance: 1, stampsRequired: 5 } });
    const tx = await t.prisma.stampTransaction.findFirstOrThrow({ where: { cardId: c.cardId } });
    expect(tx).toMatchObject({ source: 'NFC_TAP', deviceId: d.id, type: 'EARN' });
  });

  it('jede Chip-URL ist nur einmal gültig (Replay)', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 10 });
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await tap(c.client, d.read(1));
    const url = d.read(2);
    expect((await tap(c.client, url)).body.status).toBe('completed');

    // Dieselbe Person lädt die Seite neu → gleiches Ergebnis, kein zweiter Stempel
    const reload = await tap(c.client, url);
    expect(reload.body).toMatchObject({ status: 'completed', card: { balance: 1 } });
    // Eine andere Person verwendet die abfotografierte URL
    const other = await enrollCustomer(t, m, p, { firstName: 'Tom' });
    const replay = await tap(other.client, url);
    expect(replay.status).toBe(422);
    expect(replay.body.error.code).toBe('tap_replayed');
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: other.cardId } })).balance).toBe(0);
    expect(await t.prisma.stampTransaction.count({ where: { organizationId: m.organizationId } })).toBe(1);
  });

  it('gleichzeitiges Einreichen derselben URL ergibt genau einen Stempel', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 50 });
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await tap(c.client, d.read(1));
    const url = d.read(2);
    const results = await Promise.all(Array.from({ length: 10 }, () => tap(c.client, url)));
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(1);
    expect(await t.prisma.tapEvent.count({ where: { deviceId: d.id } })).toBe(1);
  });

  it('toleriert leicht vertauschte Zähler, lehnt alte Zählerstände aber ab', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 50 });
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await tap(c.client, d.read(1));
    expect((await tap(c.client, d.read(20))).body.status).toBe('completed');
    // Zähler 18 wurde vom Chip vergeben, aber die URL erst später geöffnet → noch gültig
    expect((await tap(c.client, d.read(18))).body.status).toBe('completed');
    // Zähler 3 liegt weit zurück → abgelehnt
    const old = await tap(c.client, d.read(3));
    expect(old.body.error.code).toBe('tap_replayed');
    expect((await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } })).lastCounter).toBe(20);
  });

  it('lehnt gefälschte und manipulierte Anfragen ab, ohne Details preiszugeben', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await tap(c.client, d.read(1));
    const good = d.read(2);

    const forged = generateSun({ metaKey: randomBytes(16), fileKey: randomBytes(16), uidHex: d.uidHex, counter: 2 });
    const cases = [
      { deviceId: d.publicId, e: forged.piccDataHex, c: forged.macHex },
      { ...good, c: good.c.slice(0, 15) + (good.c.endsWith('0') ? '1' : '0') },
      { ...good, e: (good.e.startsWith('0') ? '1' : '0') + good.e.slice(1) },
      { ...good, deviceId: 'st_gibtesnicht' },
    ];
    for (const params of cases) {
      const res = await tap(c.client, params);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('tap_invalid');
    }
    // Manipulierte Gerätekennung: gültige Parameter eines anderen Geräts
    const d2 = await physicalDevice(m, p.id);
    expect((await tap(c.client, { ...good, deviceId: d2.publicId })).body.error.code).toBe('tap_invalid');
    expect((await tap(c.client, { deviceId: d.publicId, e: 'zz', c: 'zz' })).status).toBe(400);

    expect((await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } })).rejectedTaps).toBe(3);
    expect((await tap(c.client, good)).body.status).toBe('completed');
  });

  it('erkennt kopierte Schlüssel auf einem fremden Chip (UID-Abweichung) und sperrt das Gerät', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await tap(c.client, d.read(1));
    const clone = await tap(c.client, d.read(2, '04FFFFFFFFFFFF'));
    expect(clone.body.error.code).toBe('tap_invalid');
    expect((await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } })).securityStatus).toBe('COMPROMISED');
    expect((await tap(c.client, d.read(3))).body.error.code).toBe('device_inactive');
    expect((await m.client.put(`/devices/${d.id}/status`, { status: 'ACTIVE' })).status).toBe(409);
  });

  it('verlorene Stempel sind sofort wertlos; Schlüsselrotation erzwingt Neuaktivierung', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0 });
    const d = await physicalDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await tap(c.client, d.read(1));
    expect((await m.client.put(`/devices/${d.id}/status`, { status: 'LOST', reason: 'Im Laden verschwunden' })).body.device).toMatchObject({ status: 'LOST', securityStatus: 'COMPROMISED' });
    expect((await tap(c.client, d.read(2))).body.error.code).toBe('device_inactive');

    const rotated = await m.client.post(`/devices/${d.id}/rotate-keys`);
    expect(rotated.body.device).toMatchObject({ status: 'PENDING', keyVersion: 2, uidHex: null, securityStatus: 'OK' });
    // Der alte Chip (alte Schlüssel) kann das Gerät nicht wieder aktivieren
    expect((await tap(c.client, d.read(3))).body.error.code).toBe('tap_invalid');
    expect((await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('PENDING');
  });

  it('deaktivierte Stempel vergeben nichts', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await m.client.put(`/devices/${d.id}/status`, { status: 'DISABLED' });
    const params = await simulateTap(m, d.id);
    expect((await tap(c.client, params)).body.error.code).toBe('device_inactive');
    await m.client.put(`/devices/${d.id}/status`, { status: 'ACTIVE' });
    expect((await tap(c.client, await simulateTap(m, d.id))).body.status).toBe('completed');
  });
});

describe('Buchungsrichtlinien', () => {
  it('AUTO: Mindestabstand und Tageslimit verhindern wiederholte Stempel', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 30, maxStampsPerDay: 2 });
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    expect((await tap(c.client, await simulateTap(m, d.id))).body).toMatchObject({ status: 'completed', simulated: true });
    const soon = await tap(c.client, await simulateTap(m, d.id));
    expect(soon.body).toMatchObject({ status: 'rejected', code: 'stamp_too_soon', card: { balance: 1 } });

    await t.prisma.loyaltyCard.update({ where: { id: c.cardId }, data: { lastStampAt: new Date(Date.now() - 3_600_000) } });
    expect((await tap(c.client, await simulateTap(m, d.id))).body.status).toBe('completed');
    await t.prisma.loyaltyCard.update({ where: { id: c.cardId }, data: { lastStampAt: new Date(Date.now() - 3_600_000) } });
    expect((await tap(c.client, await simulateTap(m, d.id))).body).toMatchObject({ status: 'rejected', code: 'daily_limit_reached' });
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(2);
    const tx = await t.prisma.stampTransaction.findFirstOrThrow({ where: { cardId: c.cardId } });
    expect(tx.source).toBe('SIMULATED_TAP');
  });

  it('Tap ohne Karte führt durch die Anmeldung und stempelt danach', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const d = await createSimDevice(m, p.id);
    const browser = new Client(t);
    const first = await tap(browser, await simulateTap(m, d.id));
    expect(first.body.status).toBe('needs_enrollment');
    expect(first.body.program.cardTitle).toBe('Kaffeekarte');
    const enroll = await browser.post(`/public/programs/${m.orgSlug}/${p.slug}/enroll`, { firstName: 'Neu', acceptPrivacy: true, tapToken: first.body.tapToken });
    expect(enroll.body).toMatchObject({ created: true, tap: { status: 'completed', card: { balance: 1 } } });
    // Der Tap kann nicht ein zweites Mal eingelöst werden
    const other = await enrollCustomer(t, m, p, { firstName: 'Dieb', tapToken: first.body.tapToken });
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: other.cardId } })).balance).toBe(0);
  });

  it('STAFF_CONFIRM: Stempel erst nach Freigabe durch Mitarbeitende', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { bookingPolicy: 'STAFF_CONFIRM' });
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    const pending = await tap(c.client, await simulateTap(m, d.id));
    expect(pending.body.status).toBe('pending_approval');
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(0);
    expect((await c.client.get(`/public/taps/${pending.body.tapToken}`)).body.status).toBe('pending_approval');

    const queue = await m.client.get('/taps/pending');
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({ customerName: 'Lena', deviceName: 'Theke' });
    const [a, b] = await Promise.all([
      m.client.post(`/taps/${queue.body[0].id}/decision`, { decision: 'APPROVE' }),
      m.client.post(`/taps/${queue.body[0].id}/decision`, { decision: 'APPROVE' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect((await c.client.get(`/public/taps/${pending.body.tapToken}`)).body).toMatchObject({ status: 'completed', card: { balance: 1 } });

    const second = await tap(c.client, await simulateTap(m, d.id));
    const q2 = await m.client.get('/taps/pending');
    await m.client.post(`/taps/${q2.body[0].id}/decision`, { decision: 'REJECT' });
    expect((await c.client.get(`/public/taps/${second.body.tapToken}`)).body.status).toBe('rejected');
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(1);
  });

  it('nicht freigegebene Taps verfallen', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { bookingPolicy: 'STAFF_CONFIRM' });
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    const pending = await tap(c.client, await simulateTap(m, d.id));
    await t.prisma.tapEvent.updateMany({ where: { deviceId: d.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await c.client.get(`/public/taps/${pending.body.tapToken}`)).body.status).toBe('expired');
    expect((await m.client.get('/taps/pending')).body).toHaveLength(0);
  });

  it('POS_EVENT: Stempel nur mit passendem Kassen-Ereignis (über die API mit Schlüssel)', async () => {
    const m = await registerMerchant(t);
    await t.prisma.subscription.update({ where: { organizationId: m.organizationId }, data: { planId: 'premium' } });
    const p = await createProgram(m, { bookingPolicy: 'POS_EVENT', minIntervalMinutes: 0, maxStampsPerDay: 10 });
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    const apiKey = (await m.client.post('/organization/api-keys', { name: 'Kasse' })).body.key as string;
    expect(apiKey.startsWith('tapperl_')).toBe(true);
    const pos = (body: object, key = apiKey) => new Client(t).agent.post('/integrations/pos/events').set('Authorization', `Bearer ${key}`).send(body);

    expect((await pos({ externalId: 'x' }, 'tapperl_falsch')).status).toBe(401);

    // Reihenfolge 1: erst Tap, dann Kasse
    const waiting = await tap(c.client, await simulateTap(m, d.id));
    expect(waiting.body.status).toBe('pending_pos');
    const event = await pos({ externalId: 'bon-1001', amountCents: 420, currency: 'EUR' });
    expect(event.body).toMatchObject({ duplicate: false, matched: true });
    expect((await c.client.get(`/public/taps/${waiting.body.tapToken}`)).body).toMatchObject({ status: 'completed', card: { balance: 1 } });
    // Wiederholte Zustellung desselben Bons bucht nicht erneut
    expect((await pos({ externalId: 'bon-1001', amountCents: 420 })).body.duplicate).toBe(true);

    // Reihenfolge 2: erst Kasse, dann Tap
    expect((await pos({ externalId: 'bon-1002' })).body.matched).toBe(false);
    expect((await tap(c.client, await simulateTap(m, d.id))).body).toMatchObject({ status: 'completed', card: { balance: 2 } });
    // Ein Bon reicht nur für einen Stempel
    expect((await tap(c.client, await simulateTap(m, d.id))).body.status).toBe('pending_pos');
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(2);
  });

  it('Kassen-Schnittstelle ist an den Tarif gebunden und Schlüssel sind widerrufbar', async () => {
    const m = await registerMerchant(t);
    expect((await m.client.post('/organization/api-keys', { name: 'Kasse' })).body.error.code).toBe('feature_not_in_plan');
    await t.prisma.subscription.update({ where: { organizationId: m.organizationId }, data: { planId: 'premium' } });
    const created = await m.client.post('/organization/api-keys', { name: 'Kasse' });
    const list = await m.client.get('/organization/api-keys');
    expect(JSON.stringify(list.body)).not.toContain(created.body.key);
    await m.client.delete(`/organization/api-keys/${created.body.id}`);
    const res = await new Client(t).agent.post('/integrations/pos/events').set('Authorization', `Bearer ${created.body.key}`).send({ externalId: 'a' });
    expect(res.status).toBe(401);
  });

  it('Bonus-Aktion verdoppelt Stempel im Aktionszeitraum', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    const campaign = await m.client.post('/campaigns', { name: 'Doppelte Stempel', type: 'BONUS_STAMPS', channels: ['CARD'], subject: 'Heute doppelt', config: { multiplier: 2 } });
    expect(campaign.status).toBe(201);
    await m.client.post(`/campaigns/${campaign.body.id}/launch`);
    const res = await tap(c.client, await simulateTap(m, d.id));
    expect(res.body).toMatchObject({ status: 'completed', amount: 2, card: { balance: 2 } });
    expect((await c.client.get(`/public/cards/${c.cardId}`)).body.offers[0].subject).toBe('Heute doppelt');
  });

  it('auffällig viele Taps an einem Gerät werden markiert', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 100 });
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    for (let i = 0; i < 42; i++) await tap(c.client, await simulateTap(m, d.id));
    expect(await t.prisma.stampTransaction.count({ where: { cardId: c.cardId, flagged: true, flagReason: 'device_velocity' } })).toBeGreaterThan(0);
    expect((await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } })).securityStatus).toBe('WARNING');
  });

  it('gemessene Verarbeitungszeit eines Taps im Backend (lokal, ohne Netzwerk)', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 100 });
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    const durations: number[] = [];
    for (let i = 0; i < 30; i++) {
      const params = await simulateTap(m, d.id);
      const start = performance.now();
      const res = await tap(c.client, params);
      durations.push(performance.now() - start);
      expect(res.body.status).toBe('completed');
    }
    durations.sort((a, b) => a - b);
    const median = durations[15]!;
    const p95 = durations[28]!;
    console.log(`TAP_LATENCY median=${median.toFixed(1)}ms p95=${p95.toFixed(1)}ms n=30`);
    expect(p95).toBeLessThan(1000);
  });
});

describe('Aktiver Stempel (Ausbaustufe B, Backend-Schnittstelle)', () => {
  it('akzeptiert nur korrekt signierte, nicht wiederholte Gerätemeldungen', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 10 });
    const c = await enrollCustomer(t, m, p);
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicId = `st_${uniq('active')}`;
    await t.prisma.nfcDevice.create({
      data: { organizationId: m.organizationId, programId: p.id, publicId, name: 'Aktiver Stempel', kind: 'ACTIVE_READER', status: 'ACTIVE', publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') },
    });
    const shortCode = (await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).shortCode;
    const send = (sequence: number, opts: { tamper?: boolean; key?: typeof privateKey } = {}) => {
      const body = JSON.stringify({ cardIdentifier: shortCode, channel: 'qr', sequence });
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = randomBytes(12).toString('hex');
      const signature = signDeviceRequest(opts.key ?? privateKey, { publicId, timestamp, nonce, method: 'POST', path: '/devices/v1/taps', body });
      return new Client(t).agent
        .post('/devices/v1/taps')
        .set('Content-Type', 'application/json')
        .set('X-Tapperl-Device', publicId)
        .set('X-Tapperl-Timestamp', String(timestamp))
        .set('X-Tapperl-Nonce', nonce)
        .set('X-Tapperl-Signature', signature)
        .send(opts.tamper ? body.replace(`"sequence":${sequence}`, `"sequence":${sequence + 100}`) : body);
    };
    expect((await send(1)).body).toMatchObject({ status: 'completed', balance: 1 });
    expect((await send(1)).body.error.code).toBe('tap_replayed');
    expect((await send(2, { tamper: true })).status).toBe(401);
    expect((await send(3, { key: generateKeyPairSync('ed25519').privateKey })).status).toBe(401);
    expect((await send(4)).body.balance).toBe(2);
  });
});

describe('Einrichtung per Android-App', () => {
  // Chips brauchen https-URLs → eigene App-Instanz mit https-WEB_URL.
  const originalWebUrl = process.env.WEB_URL;
  let outer: TestApp;
  beforeAll(async () => {
    outer = t;
    t = await createApp({ WEB_URL: 'https://karte.example.at' });
  });
  afterAll(async () => {
    await t.close();
    t = outer;
    if (originalWebUrl === undefined) delete process.env.WEB_URL;
    else process.env.WEB_URL = originalWebUrl;
  });

  it('lehnt Codes ab, solange die Kunden-Website kein https verwendet', async () => {
    const m = await registerMerchant(outer);
    const p = await createProgram(m);
    const created = await m.client.post('/devices', { name: 'Theke', kind: 'PASSIVE_NTAG424', programId: p.id });
    const res = await m.client.post(`/devices/${created.body.device.id}/provisioning`);
    expect(res.status).toBe(409);
  });

  async function setup() {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const created = await m.client.post('/devices', { name: 'Theke', kind: 'PASSIVE_NTAG424', programId: p.id });
    return { m, id: created.body.device.id as string };
  }
  // Die App sendet weder Cookie noch CSRF-Header.
  const anon = () => ({ post: (path: string, body: object) => request(t.app.getHttpServer()).post(path).send(body) });

  it('Code erzeugen → Schlüssel abholen → Chip-Signatur melden → Stempel aktiv', async () => {
    const { m, id } = await setup();
    const res = await m.client.post(`/devices/${id}/provisioning`);
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(res.body.appUrl).toContain('tapperl://einrichten?code=');
    expect(res.body.webUrl).toContain('/einrichten?code=');

    const fetched = await anon().post('/devices/v1/provisioning/fetch', { code: res.body.code.toLowerCase() });
    expect(fetched.status).toBe(200);
    expect(fetched.body.keys.master).toMatch(/^[0-9A-F]{32}$/);
    expect(fetched.body.profile.ndefUriPayload).toContain(`/t/${fetched.body.device.publicId}?e=`);
    expect(fetched.body.previousKeys).toEqual({ sdmMetaRead: [], sdmFileRead: [] });
    // Zweiter Abruf (z. B. nach Abbruch) liefert denselben Masterschlüssel.
    const again = await anon().post('/devices/v1/provisioning/fetch', { code: res.body.code });
    expect(again.body.keys.master).toBe(fetched.body.keys.master);

    const keys = { metaKey: Buffer.from(fetched.body.keys.sdmMetaRead, 'hex'), fileKey: Buffer.from(fetched.body.keys.sdmFileRead, 'hex') };
    const bad = generateSun({ metaKey: randomBytes(16), fileKey: keys.fileKey, uidHex: '04AABBCCDDEEFF', counter: 1 });
    const rejected = await anon().post('/devices/v1/provisioning/complete', { code: res.body.code, e: bad.piccDataHex, c: bad.macHex });
    expect(rejected.status).toBe(400);

    const sun = generateSun({ ...keys, uidHex: '04AABBCCDDEEFF', counter: 1 });
    const done = await anon().post('/devices/v1/provisioning/complete', { code: res.body.code, e: sun.piccDataHex, c: sun.macHex });
    expect(done.status).toBe(200);
    expect(done.body.device).toMatchObject({ status: 'ACTIVE', uidHex: '04AABBCCDDEEFF' });

    const device = await m.client.get(`/devices/${id}`);
    expect(device.body.device).toMatchObject({ status: 'ACTIVE', uidHex: '04AABBCCDDEEFF', lastCounter: 1 });
    // Code ist danach verbraucht.
    expect((await anon().post('/devices/v1/provisioning/fetch', { code: res.body.code })).status).toBe(404);

    // Nach einer Schlüsselrotation liefert der nächste Code die alten Chip-Schlüssel als Kandidaten.
    await m.client.post(`/devices/${id}/rotate-keys`);
    const res2 = await m.client.post(`/devices/${id}/provisioning`);
    const fetched2 = await anon().post('/devices/v1/provisioning/fetch', { code: res2.body.code });
    expect(fetched2.body.previousKeys.sdmMetaRead).toEqual([fetched.body.keys.sdmMetaRead]);
    expect(fetched2.body.keys.sdmMetaRead).not.toBe(fetched.body.keys.sdmMetaRead);
    expect(fetched2.body.keys.master).toBe(fetched.body.keys.master);
  });

  it('ungültige, fremde und ersetzte Codes werden abgelehnt', async () => {
    const { m, id } = await setup();
    expect((await anon().post('/devices/v1/provisioning/fetch', { code: 'AAAAA-BBBBB' })).status).toBe(404);
    const first = await m.client.post(`/devices/${id}/provisioning`);
    await m.client.post(`/devices/${id}/provisioning`);
    expect((await anon().post('/devices/v1/provisioning/fetch', { code: first.body.code })).status).toBe(404);

    const other = await registerMerchant(t);
    expect((await other.client.post(`/devices/${id}/provisioning`)).status).toBe(404);
    const sim = await other.client.post('/devices', { name: 'Sim', kind: 'SIMULATED' });
    if (sim.status === 201) expect((await other.client.post(`/devices/${sim.body.device.id}/provisioning`)).status).toBe(409);
  });
});
