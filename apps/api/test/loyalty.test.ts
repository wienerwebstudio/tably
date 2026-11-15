import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { Client, createApp, createProgram, createSimDevice, enrollCustomer, registerMerchant, resetDb, simulateTap, uniq, type TestApp } from './helpers';

let t: TestApp;
let ledger: LedgerService;
beforeAll(async () => {
  t = await createApp();
  await resetDb(t.prisma);
  ledger = t.app.get(LedgerService);
});
afterAll(() => t.close());

const key = () => uniq('idem-key-');
const stamp = (client: Client, cardId: string, k = key(), amount = 1) => client.post('/stamps/manual', { cardId, amount }).set('Idempotency-Key', k);

describe('Programme und Webkarte', () => {
  it('veröffentlicht nur mit bestätigter E-Mail-Adresse und Prämie', async () => {
    const m = await registerMerchant(t);
    await t.prisma.user.update({ where: { id: m.userId }, data: { emailVerifiedAt: null } });
    const created = await m.client.post('/programs', { name: 'Kaffeekarte', cardTitle: 'Kaffeekarte', reward: { name: 'Gratis Kaffee' } });
    expect(created.body.signupUrl).toBe(`http://localhost:3000/j/${m.orgSlug}/kaffeekarte`);
    const blocked = await m.client.put(`/programs/${created.body.id}/status`, { status: 'PUBLISHED' });
    expect(blocked.body.error.code).toBe('email_not_verified');
    await t.prisma.user.update({ where: { id: m.userId }, data: { emailVerifiedAt: new Date() } });
    expect((await m.client.put(`/programs/${created.body.id}/status`, { status: 'PUBLISHED' })).body.status).toBe('PUBLISHED');
  });

  it('Teilaktualisierung des Designs überschreibt keine anderen Felder', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    await m.client.patch(`/programs/${p.id}`, { design: { backgroundColor: '#112233', footerText: 'Danke!' } });
    const upd = await m.client.patch(`/programs/${p.id}`, { design: { accentColor: '#ABCDEF' } });
    expect(upd.body.design).toMatchObject({ backgroundColor: '#112233', accentColor: '#ABCDEF', footerText: 'Danke!' });
  });

  it('Kund:in meldet sich an und sieht die Karte nur im eigenen Browser', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const info = await new Client(t).get(`/public/programs/${m.orgSlug}/${p.slug}`);
    expect(info.body).toMatchObject({ open: true, cardId: null });
    expect(info.body.program.rewards[0]).toMatchObject({ name: 'Gratis Kaffee', cost: 5 });

    const c = await enrollCustomer(t, m, p, { email: `${uniq('lena')}@example.com`, marketingConsent: true });
    const card = await c.client.get(`/public/cards/${c.cardId}`);
    expect(card.status).toBe(200);
    expect(card.body).toMatchObject({ balance: 0, marketingConsent: true });
    expect(card.body.shortCode).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect((await new Client(t).get(`/public/cards/${c.cardId}`)).status).toBe(404);

    // Erneutes Anmelden im selben Browser legt keine zweite Karte an
    const again = await c.client.post(`/public/programs/${m.orgSlug}/${p.slug}/enroll`, { firstName: 'Lena', acceptPrivacy: true });
    expect(again.body).toMatchObject({ cardId: c.cardId, created: false });
    const consents = await t.prisma.consentRecord.findMany({ where: { organizationId: m.organizationId } });
    expect(consents.map((x) => `${x.type}:${x.granted}`).sort()).toEqual(['MARKETING_EMAIL:true', 'MARKETING_WALLET:true', 'PRIVACY:true']);
  });

  it('verhindert Kontoübernahme über eine bekannte E-Mail-Adresse', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const email = `${uniq('dup')}@example.com`;
    await enrollCustomer(t, m, p, { email });
    const res = await new Client(t).post(`/public/programs/${m.orgSlug}/${p.slug}/enroll`, { firstName: 'Angreifer', email, acceptPrivacy: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it('stellt die Karte per E-Mail-Link auf einem neuen Gerät wieder her', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const email = `${uniq('rec')}@example.com`;
    const c = await enrollCustomer(t, m, p, { email });
    const fresh = new Client(t);
    expect((await fresh.post('/public/recover', { orgSlug: m.orgSlug, email })).status).toBe(200);
    const mail = await t.prisma.notification.findFirstOrThrow({ where: { recipient: email, provider: { endsWith: 'customer.recover' } } });
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.body)![1]!;
    expect((await fresh.post('/public/recover/consume', { token })).body.cardId).toBe(c.cardId);
    expect((await fresh.get(`/public/cards/${c.cardId}`)).status).toBe(200);
    expect((await new Client(t).post('/public/recover/consume', { token })).status).toBe(422);
  });

  it('Willkommensbonus wird einmalig gutgeschrieben', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { signupBonus: 2 });
    const c = await enrollCustomer(t, m, p);
    expect((await c.client.get(`/public/cards/${c.cardId}`)).body.balance).toBe(2);
  });
});

describe('Buchungen: Idempotenz, Nebenläufigkeit, Nachvollziehbarkeit', () => {
  it('verlangt einen Idempotency-Key', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const res = await m.client.post('/stamps/manual', { cardId: c.cardId });
    expect(res.status).toBe(400);
  });

  it('bucht dieselbe Anfrage nur einmal', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const k = key();
    const first = await stamp(m.client, c.cardId, k);
    const second = await stamp(m.client, c.cardId, k);
    expect(first.body).toMatchObject({ balance: 1, duplicate: false });
    expect(second.body).toMatchObject({ balance: 1, duplicate: true, transactionId: first.body.transactionId });
    expect(await t.prisma.stampTransaction.count({ where: { cardId: c.cardId } })).toBe(1);
  });

  it('20 gleichzeitige Anfragen mit demselben Key ergeben genau eine Buchung', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const k = key();
    const results = await Promise.all(Array.from({ length: 20 }, () => stamp(m.client, c.cardId, k)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.duplicate === false)).toHaveLength(1);
    const card = await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } });
    expect(card.balance).toBe(1);
  });

  it('20 gleichzeitige Buchungen mit verschiedenen Keys gehen nicht verloren; Stand = Summe des Ledgers', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const results = await Promise.all(Array.from({ length: 20 }, () => stamp(m.client, c.cardId)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const card = await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } });
    expect(card.balance).toBe(20);
    expect(await ledger.ledgerSum(c.cardId)).toBe(20);
    const entries = await t.prisma.pointLedger.findMany({ where: { cardId: c.cardId }, orderBy: { balanceAfter: 'asc' } });
    expect(entries.map((e) => e.balanceAfter)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('Korrekturen brauchen eine Begründung, Stände werden nie negativ', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    await stamp(m.client, c.cardId, key(), 3);
    expect((await m.client.post('/stamps/adjust', { cardId: c.cardId, delta: -1 }).set('Idempotency-Key', key())).status).toBe(400);
    const ok = await m.client.post('/stamps/adjust', { cardId: c.cardId, delta: -1, note: 'Fehlbuchung' }).set('Idempotency-Key', key());
    expect(ok.body.balance).toBe(2);
    const tooMuch = await m.client.post('/stamps/adjust', { cardId: c.cardId, delta: -5, note: 'zu viel' }).set('Idempotency-Key', key());
    expect(tooMuch.body.error.code).toBe('insufficient_balance');
  });

  it('Storno erzeugt eine Gegenbuchung und ist nur einmal möglich', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const s = await stamp(m.client, c.cardId, key(), 2);
    const rev = await m.client.post(`/stamps/${s.body.transactionId}/reverse`, {});
    expect(rev.body.balance).toBe(0);
    expect((await m.client.post(`/stamps/${s.body.transactionId}/reverse`, {})).status).toBe(409);
    expect(await ledger.ledgerSum(c.cardId)).toBe(0);
    expect(await t.prisma.stampTransaction.count({ where: { cardId: c.cardId } })).toBe(2);
  });

  it('manuelle Buchung innerhalb des Mindestabstands wird markiert', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 30 });
    const c = await enrollCustomer(t, m, p);
    expect((await stamp(m.client, c.cardId)).body.flagged).toBe(false);
    expect((await stamp(m.client, c.cardId)).body.flagged).toBe(true);
    const flagged = await m.client.get('/stamps?flagged=true');
    expect(flagged.body.total).toBe(1);
    expect(flagged.body.items[0].flagReason).toBe('limit_override_interval');
  });
});

describe('Prämien', () => {
  it('Einlösung über Code: abgebucht wird erst bei Bestätigung, und nur einmal', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const early = await c.client.post(`/public/cards/${c.cardId}/redemptions`, { rewardId: p.rewardId });
    expect(early.body.error.code).toBe('insufficient_balance');

    await stamp(m.client, c.cardId, key(), 6);
    const view = await c.client.get(`/public/cards/${c.cardId}`);
    expect(view.body.rewards[0]).toMatchObject({ available: true, missing: 0 });

    const req = await c.client.post(`/public/cards/${c.cardId}/redemptions`, { rewardId: p.rewardId });
    expect(req.body.code).toMatch(/^\d{6}$/);
    expect((await c.client.get(`/public/cards/${c.cardId}`)).body.balance).toBe(6);

    expect((await m.client.post('/stamps/redeem-code', { code: req.body.code === '000000' ? '111111' : '000000' })).body.error.code).toBe('code_invalid');
    const [a, b] = await Promise.all([m.client.post('/stamps/redeem-code', { code: req.body.code }), m.client.post('/stamps/redeem-code', { code: req.body.code })]);
    const ok = [a, b].filter((r) => r.status === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(ok[0]!.body).toMatchObject({ rewardName: 'Gratis Kaffee', customerName: 'Lena', balance: 1 });
    const card = await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } });
    expect(card.balance).toBe(1);
    expect(card.lifetimeRedeemed).toBe(5);
    expect(await t.prisma.stampTransaction.count({ where: { cardId: c.cardId, type: 'REDEEM' } })).toBe(1);
    expect((await m.client.post('/stamps/redeem-code', { code: req.body.code })).body.error.code).toBe('code_invalid');
  });

  it('gleichzeitige Direkteinlösungen können den Stand nicht überziehen', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    await stamp(m.client, c.cardId, key(), 5);
    const results = await Promise.all(Array.from({ length: 8 }, () => m.client.post('/stamps/redeem', { cardId: c.cardId, rewardId: p.rewardId }).set('Idempotency-Key', key())));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.body.error?.code === 'insufficient_balance')).toHaveLength(7);
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(0);
  });

  it('abgelaufene Codes sind wertlos', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    await stamp(m.client, c.cardId, key(), 5);
    const req = await c.client.post(`/public/cards/${c.cardId}/redemptions`, { rewardId: p.rewardId });
    await t.prisma.rewardRedemption.updateMany({ where: { cardId: c.cardId }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
    expect((await m.client.post('/stamps/redeem-code', { code: req.body.code })).body.error.code).toBe('code_invalid');
  });
});

describe('Mandantentrennung', () => {
  it('ein Händler erreicht keinerlei Daten eines anderen', async () => {
    const a = await registerMerchant(t, 'Café A');
    const b = await registerMerchant(t, 'Friseur B');
    const pa = await createProgram(a);
    const ca = await enrollCustomer(t, a, pa, { email: `${uniq('a')}@example.com` });
    const da = await createSimDevice(a, pa.id);
    const customerA = await t.prisma.customer.findFirstOrThrow({ where: { organizationId: a.organizationId } });
    const locationA = await t.prisma.location.findFirstOrThrow({ where: { organizationId: a.organizationId } });
    const txA = await stamp(a.client, ca.cardId);

    expect((await b.client.get('/customers')).body.total).toBe(0);
    expect((await b.client.get('/programs')).body).toHaveLength(0);
    expect((await b.client.get('/devices')).body).toHaveLength(0);
    expect((await b.client.get('/stamps')).body.total).toBe(0);

    const attempts = await Promise.all([
      b.client.get(`/customers/${customerA.id}`),
      b.client.patch(`/customers/${customerA.id}`, { firstName: 'Gekapert' }),
      b.client.delete(`/customers/${customerA.id}`),
      b.client.get(`/customers/${customerA.id}/export`),
      b.client.get(`/programs/${pa.id}`),
      b.client.patch(`/programs/${pa.id}`, { name: 'Gekapert' }),
      b.client.put(`/programs/${pa.id}/status`, { status: 'ARCHIVED' }),
      b.client.post(`/programs/${pa.id}/rewards`, { name: 'X', cost: 1 }),
      b.client.get(`/devices/${da.id}`),
      b.client.put(`/devices/${da.id}/status`, { status: 'DISABLED' }),
      b.client.post(`/devices/${da.id}/simulate-tap`),
      b.client.post(`/devices/${da.id}/personalization`),
      b.client.post(`/devices/${da.id}/rotate-keys`),
      b.client.patch(`/organization/locations/${locationA.id}`, { name: 'Gekapert' }),
      stamp(b.client, ca.cardId),
      b.client.post('/stamps/adjust', { cardId: ca.cardId, delta: 5, note: 'fremd' }).set('Idempotency-Key', key()),
      b.client.post('/stamps/redeem', { cardId: ca.cardId, rewardId: pa.rewardId }).set('Idempotency-Key', key()),
      b.client.post(`/stamps/${txA.body.transactionId}/reverse`, {}),
      b.client.post('/stamps/lookup', { code: (await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: ca.cardId } })).shortCode }),
    ]);
    expect(attempts.map((r) => r.status)).toEqual(attempts.map(() => 404));

    // Fremde Referenzen in eigenen Objekten werden ebenfalls abgelehnt
    const pb = await createProgram(b);
    expect((await b.client.post('/devices', { name: 'X', kind: 'SIMULATED', programId: pa.id })).status).toBe(404);
    expect((await b.client.post('/devices', { name: 'X', kind: 'SIMULATED', programId: pb.id, locationId: locationA.id })).status).toBe(404);
    expect((await b.client.post('/customers', { firstName: 'X', programId: pa.id })).status).toBe(404);
    const cb = await enrollCustomer(t, b, pb);
    expect((await b.client.post('/stamps/manual', { cardId: cb.cardId, locationId: locationA.id }).set('Idempotency-Key', key())).status).toBe(404);
    expect((await b.client.post('/stamps/redeem', { cardId: cb.cardId, rewardId: pa.rewardId }).set('Idempotency-Key', key())).status).toBe(404);

    // Unverändert
    expect((await t.prisma.customer.findUniqueOrThrow({ where: { id: customerA.id } })).firstName).toBe('Lena');
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: ca.cardId } })).balance).toBe(1);
  });

  it('gleiche Idempotency-Keys verschiedener Mandanten beeinflussen sich nicht', async () => {
    const a = await registerMerchant(t);
    const b = await registerMerchant(t);
    const [pa, pb] = [await createProgram(a), await createProgram(b)];
    const [ca, cb] = [await enrollCustomer(t, a, pa), await enrollCustomer(t, b, pb)];
    const k = key();
    expect((await stamp(a.client, ca.cardId, k)).body.duplicate).toBe(false);
    expect((await stamp(b.client, cb.cardId, k)).body).toMatchObject({ duplicate: false, balance: 1 });
  });

  it('Kundenkonten sind je Händler getrennt, auch im selben Browser', async () => {
    const a = await registerMerchant(t);
    const b = await registerMerchant(t);
    const [pa, pb] = [await createProgram(a), await createProgram(b)];
    const c = await enrollCustomer(t, a, pa);
    const second = await c.client.post(`/public/programs/${b.orgSlug}/${pb.slug}/enroll`, { firstName: 'Lena', acceptPrivacy: true });
    expect(second.body.created).toBe(true);
    const cards = await c.client.get('/public/cards');
    expect(cards.body).toHaveLength(2);
    expect(await t.prisma.customer.count({ where: { organizationId: b.organizationId } })).toBe(1);
    expect((await b.client.get('/customers')).body.total).toBe(1);
  });
});

describe('Kundenverwaltung und DSGVO', () => {
  it('sucht, filtert, exportiert und löscht', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const email = `${uniq('mara')}@example.com`;
    const c1 = await enrollCustomer(t, m, p, { firstName: 'Mara', email, birthday: '1990-05-17' });
    await enrollCustomer(t, m, p, { firstName: 'Jonas' });
    await stamp(m.client, c1.cardId, key(), 5);

    expect((await m.client.get('/customers?q=mara')).body.total).toBe(1);
    expect((await m.client.get('/customers?activity=reward_ready')).body.items.map((x: { firstName: string }) => x.firstName)).toEqual(['Mara']);
    const code = (await c1.client.get(`/public/cards/${c1.cardId}`)).body.shortCode as string;
    expect((await m.client.get(`/customers?q=${code}`)).body.total).toBe(1);

    const customer = await t.prisma.customer.findFirstOrThrow({ where: { organizationId: m.organizationId, email } });
    // Teilaktualisierung lässt andere Felder unberührt
    const upd = await m.client.patch(`/customers/${customer.id}`, { phone: '+49 30 1234' });
    expect(upd.body.customer).toMatchObject({ firstName: 'Mara', email, phone: '+49 30 1234' });

    const csv = await m.client.get('/customers/export.csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Mara');

    const exp = await m.client.get(`/customers/${customer.id}/export`);
    expect(exp.body.transactions).toHaveLength(1);
    expect(exp.body.consents.length).toBeGreaterThanOrEqual(3);
    expect((await c1.client.get(`/public/cards/${c1.cardId}/export`)).body.customer.email).toBe(email);

    expect((await m.client.delete(`/customers/${customer.id}`)).status).toBe(200);
    const gone = await t.prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(gone).toMatchObject({ firstName: 'Gelöscht', email: null, phone: null, birthday: null, status: 'ANONYMIZED' });
    expect((await c1.client.get(`/public/cards/${c1.cardId}`)).status).toBe(404);
    expect(await t.prisma.stampTransaction.count({ where: { customerId: customer.id } })).toBe(1);
    expect((await m.client.get('/customers')).body.total).toBe(1);
    const audit = await m.client.get('/organization/audit');
    expect(audit.body.items.map((i: { action: string }) => i.action)).toEqual(expect.arrayContaining(['customer.anonymized', 'customer.exported', 'customer.list_exported']));
  });

  it('Kund:innen können ihre Daten selbst löschen und ihre Einwilligung widerrufen', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p, { email: `${uniq('s')}@example.com`, marketingConsent: true });
    const off = await c.client.patch(`/public/cards/${c.cardId}/profile`, { marketingConsent: false });
    expect(off.body.marketingConsent).toBe(false);
    expect(off.body.customer.firstName).toBe('Lena');
    expect((await c.client.delete(`/public/cards/${c.cardId}`)).status).toBe(200);
    expect((await m.client.get('/customers')).body.total).toBe(0);
  });

  it('gesperrte Kund:innen erhalten keine Stempel', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    const customer = await t.prisma.customer.findFirstOrThrow({ where: { organizationId: m.organizationId } });
    await m.client.patch(`/customers/${customer.id}`, { status: 'BLOCKED' });
    expect((await stamp(m.client, c.cardId)).body.error.code).toBe('customer_blocked');
    const d = await createSimDevice(m, p.id);
    const tap = await c.client.post('/public/taps', await simulateTap(m, d.id));
    expect(tap.body).toMatchObject({ status: 'rejected', code: 'customer_blocked' });
  });
});
