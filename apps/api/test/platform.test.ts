import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';
import Stripe from 'stripe';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { Client, createApp, createProgram, createSimDevice, enrollCustomer, registerMerchant, resetDb, simulateTap, uniq, type TestApp } from './helpers';

const key = () => uniq('idem-key-');
const NO_INTEGRATIONS = { STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', APPLE_PASS_TYPE_ID: '', APPLE_TEAM_ID: '', APPLE_PASS_CERT_PEM: '', APPLE_PASS_KEY_PEM: '', APPLE_WWDR_CERT_PEM: '', GOOGLE_WALLET_ISSUER_ID: '', GOOGLE_WALLET_SA_EMAIL: '', GOOGLE_WALLET_SA_PRIVATE_KEY: '' };

describe('Abrechnung im lokalen Testmodus', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createApp(NO_INTEGRATIONS);
    await resetDb(t.prisma);
  });
  afterAll(() => t.close());

  it('zeigt Tarife aus der zentralen Konfiguration und kennzeichnet den Testmodus', async () => {
    const m = await registerMerchant(t);
    const b = await m.client.get('/billing');
    expect(b.body.mode).toBe('local');
    expect(b.body.plans.map((p: { id: string; priceMonthlyCents: number }) => [p.id, p.priceMonthlyCents])).toEqual([['starter', 2900], ['business', 5900], ['premium', 9900]]);
    expect(b.body.subscription.status).toBe('TRIALING');
    const pub = await new Client(t).get('/public/plans');
    expect(pub.body.trialDays).toBe(14);
  });

  it('Tarifwechsel, Testrechnung, Kündigung und Fortsetzung', async () => {
    const m = await registerMerchant(t);
    const up = await m.client.post('/billing/change-plan', { planId: 'premium', interval: 'YEAR' });
    expect(up.body).toEqual({ applied: true });
    let b = await m.client.get('/billing');
    expect(b.body.subscription).toMatchObject({ planId: 'premium', status: 'ACTIVE', interval: 'YEAR', cancelAtPeriodEnd: false });
    expect(b.body.invoices[0]).toMatchObject({ isTest: true, amountCents: 99000, status: 'test' });
    await m.client.post('/billing/cancel');
    b = await m.client.get('/billing');
    expect(b.body.subscription.cancelAtPeriodEnd).toBe(true);
    await m.client.post('/billing/resume');
    expect((await m.client.get('/billing')).body.subscription.cancelAtPeriodEnd).toBe(false);
    expect((await m.client.post('/billing/portal')).status).toBe(503);
  });

  it('Downgrade wird abgelehnt, wenn die Nutzung nicht in den Tarif passt', async () => {
    const m = await registerMerchant(t);
    await m.client.post('/organization/locations', { name: 'Filiale 2' });
    const res = await m.client.post('/billing/change-plan', { planId: 'starter', interval: 'MONTH' });
    expect(res.status).toBe(402);
    expect(res.body.error.message).toContain('Standorte: 2 von 1');
  });

  it('abgelaufene Testphase schränkt das Konto ein; Tarifwahl hebt die Einschränkung auf', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const d = await createSimDevice(m, p.id);
    const c = await enrollCustomer(t, m, p);
    await t.prisma.subscription.update({ where: { organizationId: m.organizationId }, data: { trialEndsAt: new Date(Date.now() - 1000) } });

    const me = await m.client.get('/auth/me');
    expect(me.body.subscription).toMatchObject({ status: 'RESTRICTED', writable: false });
    expect((await m.client.get('/customers')).status).toBe(200);
    const blocked = await m.client.post('/programs', { name: 'Neu', cardTitle: 'Neu' });
    expect(blocked.status).toBe(402);
    expect(blocked.body.error.code).toBe('subscription_restricted');
    expect((await m.client.post('/stamps/manual', { cardId: c.cardId }).set('Idempotency-Key', key())).status).toBe(402);
    // Stempel per NFC und neue Anmeldungen ruhen ebenfalls
    const params = await t.prisma.nfcDevice.findUniqueOrThrow({ where: { id: d.id } });
    expect(params.status).toBe('ACTIVE');
    expect((await new Client(t).post(`/public/programs/${m.orgSlug}/${p.slug}/enroll`, { firstName: 'Neu', acceptPrivacy: true })).body.error.code).toBe('program_not_published');
    // Die Karte bleibt für Kund:innen sichtbar
    expect((await c.client.get(`/public/cards/${c.cardId}`)).status).toBe(200);

    expect((await m.client.post('/billing/change-plan', { planId: 'business', interval: 'MONTH' })).status).toBe(200);
    expect((await m.client.post('/stamps/manual', { cardId: c.cardId }).set('Idempotency-Key', key())).status).toBe(200);
    expect((await c.client.post('/public/taps', await simulateTap(m, d.id))).body.status).toBe('rejected'); // Mindestabstand – aber wieder verarbeitet
  });

  it('fehlgeschlagene Zahlung: erst Kulanzzeit, dann Einschränkung', async () => {
    const m = await registerMerchant(t);
    await m.client.post('/billing/change-plan', { planId: 'business', interval: 'MONTH' });
    await m.client.post('/billing/test/simulate', { event: 'payment_failed' });
    let me = await m.client.get('/auth/me');
    expect(me.body.subscription).toMatchObject({ status: 'PAST_DUE', writable: true });
    await m.client.post('/billing/test/simulate', { event: 'grace_expired' });
    me = await m.client.get('/auth/me');
    expect(me.body.subscription).toMatchObject({ status: 'RESTRICTED', writable: false });
    await m.client.post('/billing/test/simulate', { event: 'payment_succeeded' });
    expect((await m.client.get('/auth/me')).body.subscription.writable).toBe(true);
  });

  it('Wallet meldet ehrlich „nicht eingerichtet“', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    expect((await m.client.get('/wallet/status')).body).toMatchObject({ apple: { configured: false }, google: { configured: false } });
    expect((await c.client.get(`/public/cards/${c.cardId}`)).body.wallet).toEqual({ apple: false, google: false });
    const apple = await c.client.get(`/public/cards/${c.cardId}/wallet/apple`);
    expect(apple.status).toBe(503);
    expect(apple.body.error.code).toBe('integration_not_configured');
    expect((await c.client.get(`/public/cards/${c.cardId}/wallet/google`)).status).toBe(503);
  });
});

describe('Stripe-Webhooks', () => {
  let t: TestApp;
  const secret = 'whsec_test_secret';
  const stripe = new Stripe('sk_test_dummy');
  beforeAll(async () => {
    t = await createApp({ STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret });
    await resetDb(t.prisma);
    await t.prisma.plan.update({ where: { id: 'business' }, data: { stripePriceMonthlyId: 'price_business_m', stripePriceYearlyId: 'price_business_y' } });
  });
  afterAll(async () => {
    await t.prisma.plan.update({ where: { id: 'business' }, data: { stripePriceMonthlyId: null, stripePriceYearlyId: null } });
    await t.close();
  });

  const send = (event: object, sign = true) => {
    const payload = JSON.stringify(event);
    const header = sign ? stripe.webhooks.generateTestHeaderString({ payload, secret }) : 't=1,v1=deadbeef';
    return new Client(t).agent.post('/billing/webhooks/stripe').set('Content-Type', 'application/json').set('Stripe-Signature', header).send(payload);
  };

  it('prüft die Signatur, verarbeitet idempotent und synchronisiert das Abo', async () => {
    const m = await registerMerchant(t);
    expect((await m.client.get('/billing')).body.mode).toBe('stripe');
    const now = Math.floor(Date.now() / 1000);

    expect((await send({ id: 'evt_bad', type: 'invoice.paid', data: { object: {} } }, false)).status).toBe(400);

    const checkout = { id: `evt_${uniq('co')}`, object: 'event', type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: m.organizationId, customer: 'cus_123', subscription: 'sub_123' } } };
    expect((await send(checkout)).body).toEqual({ duplicate: false });

    const subEvent = {
      id: `evt_${uniq('sub')}`,
      object: 'event',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', customer: 'cus_123', status: 'active', cancel_at_period_end: false, metadata: { organizationId: m.organizationId }, items: { data: [{ id: 'si_1', price: { id: 'price_business_y' }, current_period_start: now, current_period_end: now + 31_536_000 }] } } },
    };
    expect((await send(subEvent)).body).toEqual({ duplicate: false });
    expect((await send(subEvent)).body).toEqual({ duplicate: true });
    let sub = await t.prisma.subscription.findUniqueOrThrow({ where: { organizationId: m.organizationId } });
    expect(sub).toMatchObject({ provider: 'STRIPE', status: 'ACTIVE', planId: 'business', interval: 'YEAR', stripeSubscriptionId: 'sub_123', stripeCustomerId: 'cus_123' });
    expect(sub.currentPeriodEnd!.getTime()).toBe((now + 31_536_000) * 1000);
    expect(await t.prisma.billingEvent.count({ where: { eventId: subEvent.id } })).toBe(1);

    const failed = { id: `evt_${uniq('inv')}`, object: 'event', type: 'invoice.payment_failed', data: { object: { id: 'in_1', customer: 'cus_123', number: 'INV-1', amount_due: 59000, currency: 'eur', lines: { data: [] } } } };
    await send(failed);
    sub = await t.prisma.subscription.findUniqueOrThrow({ where: { organizationId: m.organizationId } });
    expect(sub.status).toBe('PAST_DUE');
    expect(sub.pastDueSince).not.toBeNull();

    await send({ ...failed, id: `evt_${uniq('inv')}`, type: 'invoice.paid' });
    sub = await t.prisma.subscription.findUniqueOrThrow({ where: { organizationId: m.organizationId } });
    expect(sub).toMatchObject({ status: 'ACTIVE', pastDueSince: null });
    const invoices = await t.prisma.invoice.findMany({ where: { organizationId: m.organizationId } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ status: 'paid', amountCents: 59000, isTest: false, number: 'INV-1' });

    await send({ id: `evt_${uniq('del')}`, object: 'event', type: 'customer.subscription.deleted', data: { object: { id: 'sub_123', customer: 'cus_123', status: 'canceled', items: { data: [] } } } });
    expect((await m.client.get('/auth/me')).body.subscription).toMatchObject({ status: 'CANCELED', writable: false });
  });
});

describe('Wallet mit Testzertifikaten', () => {
  let t: TestApp;
  beforeAll(async () => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(Date.now() - 86_400_000);
    cert.validity.notAfter = new Date(Date.now() + 86_400_000);
    cert.setSubject([{ name: 'commonName', value: 'Test' }]);
    cert.setIssuer([{ name: 'commonName', value: 'Test' }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const certPem = forge.pki.certificateToPem(cert);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    t = await createApp({
      APPLE_PASS_TYPE_ID: 'pass.test.tably',
      APPLE_TEAM_ID: 'TEAM123456',
      APPLE_PASS_CERT_PEM: certPem,
      APPLE_PASS_KEY_PEM: forge.pki.privateKeyToPem(keys.privateKey),
      APPLE_WWDR_CERT_PEM: certPem,
      GOOGLE_WALLET_ISSUER_ID: '3388000000000000001',
      GOOGLE_WALLET_SA_EMAIL: 'wallet@test.iam.gserviceaccount.com',
      GOOGLE_WALLET_SA_PRIVATE_KEY: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    });
    await resetDb(t.prisma);
  });
  afterAll(async () => {
    await t.close();
    Object.assign(process.env, NO_INTEGRATIONS);
  });

  it('liefert .pkpass und Google-Link nur an die Karteninhaberin; Webservice verlangt das Pass-Token', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const c = await enrollCustomer(t, m, p);
    await m.client.post('/stamps/manual', { cardId: c.cardId, amount: 3 }).set('Idempotency-Key', key());

    expect((await new Client(t).get(`/public/cards/${c.cardId}/wallet/apple`)).status).toBe(404);
    const res = await c.client.get(`/public/cards/${c.cardId}/wallet/apple`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (d: Buffer) => chunks.push(d));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.apple.pkpass');
    const body = res.body as Buffer;
    expect(body.subarray(0, 2).toString()).toBe('PK');
    const text = body.toString('latin1');
    expect(text).toContain('"value":"3 / 5"');
    expect(text).toContain('"webServiceURL":"http://localhost:4000/wallet/apple"');
    const token = /"authenticationToken":"([^"]+)"/.exec(text)![1]!;
    const serial = /"serialNumber":"([^"]+)"/.exec(text)![1]!;

    const anon = new Client(t).agent;
    const base = `/wallet/apple/v1/devices/dev123/registrations/pass.test.tably/${serial}`;
    expect((await anon.post(base).set('Authorization', 'ApplePass falsch').send({ pushToken: 'a'.repeat(64) })).status).toBe(401);
    expect((await anon.post(base).set('Authorization', `ApplePass ${token}`).send({ pushToken: 'a'.repeat(64) })).status).toBe(201);
    expect((await anon.post(base).set('Authorization', `ApplePass ${token}`).send({ pushToken: 'a'.repeat(64) })).status).toBe(200);
    const serials = await anon.get('/wallet/apple/v1/devices/dev123/registrations/pass.test.tably');
    expect(serials.body.serialNumbers).toEqual([serial]);
    expect((await anon.get(`/wallet/apple/v1/devices/dev123/registrations/pass.test.tably?passesUpdatedSince=${serials.body.lastUpdated}`)).status).toBe(204);
    expect((await anon.get(`/wallet/apple/v1/passes/pass.test.tably/${serial}`)).status).toBe(401);
    const latest = await anon.get(`/wallet/apple/v1/passes/pass.test.tably/${serial}`).set('Authorization', `ApplePass ${token}`);
    expect(latest.status).toBe(200);
    expect(latest.headers['last-modified']).toBeDefined();
    expect((await anon.delete(base).set('Authorization', `ApplePass ${token}`)).status).toBe(200);
    expect(await t.prisma.appleDeviceRegistration.count()).toBe(0);

    const google = await c.client.get(`/public/cards/${c.cardId}/wallet/google`);
    expect(google.body.url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    const payload = JSON.parse(Buffer.from(google.body.url.split('/save/')[1].split('.')[1], 'base64url').toString());
    expect(payload.payload.loyaltyObjects[0].loyaltyPoints.balance.string).toBe('3 / 5');
    expect((await m.client.get('/wallet/status')).body).toMatchObject({ apple: { configured: true, passes: 1 }, google: { configured: true, passes: 1 } });

    // Der Link aus dem Pass öffnet die Karte auf einem neuen Gerät
    const cardUrl = /"value":"http:\/\/localhost:3000\/c\/([0-9a-f]+)"/.exec(text)![1]!;
    const fresh = new Client(t);
    expect((await fresh.post('/public/access', { token: cardUrl })).body.cardId).toBe(c.cardId);
    expect((await fresh.get(`/public/cards/${c.cardId}`)).status).toBe(200);
  });
});

describe('Marketing, Analysen, Super-Admin', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createApp(NO_INTEGRATIONS);
    await resetDb(t.prisma);
  });
  afterAll(() => t.close());

  it('Kampagnen erreichen nur Kund:innen mit Einwilligung (lokaler Testversand)', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const yes = `${uniq('yes')}@example.com`;
    const no = `${uniq('no')}@example.com`;
    await enrollCustomer(t, m, p, { firstName: 'Ja', email: yes, marketingConsent: true });
    await enrollCustomer(t, m, p, { firstName: 'Nein', email: no, marketingConsent: false });
    await enrollCustomer(t, m, p, { firstName: 'OhneMail', marketingConsent: true });

    expect((await m.client.post('/campaigns/audience', {})).body).toEqual({ total: 3, emailReachable: 1, walletReachable: 0 });
    const created = await m.client.post('/campaigns', { name: 'Herbstaktion', type: 'OFFER', channels: ['EMAIL', 'CARD'], subject: 'Kürbis-Latte ist zurück', body: 'Hallo {{vorname}}, nur diese Woche!' });
    expect(created.status).toBe(201);
    const launched = await m.client.post(`/campaigns/${created.body.id}/launch`);
    expect(launched.body.status).toBe('SENT');
    expect(launched.body.stats).toEqual({ sent: 0, sentTest: 1, failed: 0, skipped: 2 });
    expect(launched.body.mailMode).toBe('local');
    const mail = await t.prisma.notification.findFirstOrThrow({ where: { recipient: yes, campaignId: created.body.id } });
    expect(mail.status).toBe('SENT_TEST');
    expect(mail.body).toContain('Hallo Ja, nur diese Woche!');
    expect(mail.body).toContain('Abmelden');
    expect(await t.prisma.notification.count({ where: { recipient: no } })).toBe(0);
    // Erneutes Starten sendet nicht doppelt
    expect((await m.client.post(`/campaigns/${created.body.id}/launch`)).status).toBe(409);
  });

  it('Geburtstags-Automation: einmal pro Jahr, mit Bonusstempel', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const email = `${uniq('bday')}@example.com`;
    const c = await enrollCustomer(t, m, p, { email, birthday: `1990-${today.slice(5)}`, marketingConsent: true });
    await enrollCustomer(t, m, p, { firstName: 'Anderer', birthday: '1991-01-01' });
    const created = await m.client.post('/campaigns', { name: 'Geburtstag', type: 'BIRTHDAY', channels: ['EMAIL'], subject: 'Alles Gute!', body: 'Ein Stempel geht aufs Haus.', config: { bonusStamps: 1 } });
    await m.client.post(`/campaigns/${created.body.id}/launch`);
    const campaigns = t.app.get(CampaignsService);
    await campaigns.tick();
    await campaigns.tick();
    expect((await t.prisma.loyaltyCard.findUniqueOrThrow({ where: { id: c.cardId } })).balance).toBe(1);
    expect(await t.prisma.notification.count({ where: { recipient: email, campaignId: created.body.id } })).toBe(1);
    expect(await t.prisma.stampTransaction.count({ where: { organizationId: m.organizationId, source: 'CAMPAIGN' } })).toBe(1);
  });

  it('E-Mail-Kampagnen sind im Starter-Tarif nicht verfügbar', async () => {
    const m = await registerMerchant(t);
    await t.prisma.subscription.update({ where: { organizationId: m.organizationId }, data: { planId: 'starter' } });
    const res = await m.client.post('/campaigns', { name: 'X', type: 'OFFER', channels: ['EMAIL'], subject: 'Hallo' });
    expect(res.body.error.code).toBe('feature_not_in_plan');
    expect((await m.client.post('/campaigns', { name: 'X', type: 'OFFER', channels: ['CARD'], subject: 'Hallo' })).status).toBe(201);
  });

  it('Analysen entsprechen exakt den Buchungen', async () => {
    const m = await registerMerchant(t);
    const p = await createProgram(m, { minIntervalMinutes: 0, maxStampsPerDay: 20 });
    const d = await createSimDevice(m, p.id);
    const a = await enrollCustomer(t, m, p, { firstName: 'A' });
    const b = await enrollCustomer(t, m, p, { firstName: 'B' });
    for (let i = 0; i < 5; i++) await a.client.post('/public/taps', await simulateTap(m, d.id));
    await b.client.post('/public/taps', await simulateTap(m, d.id));
    await m.client.post('/stamps/redeem', { cardId: a.cardId, rewardId: p.rewardId }).set('Idempotency-Key', key());
    // Ein Besuch von A vor 40 Tagen → A ist „wiederkehrend“ und zählt zur Bindung
    const old = await t.prisma.stampTransaction.findFirstOrThrow({ where: { cardId: a.cardId, type: 'EARN' } });
    await t.prisma.stampTransaction.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 40 * 86_400_000) } });

    const res = await m.client.get('/analytics/overview?days=30');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toMatchObject({
      stamps: { current: 5, previous: 1 },
      redemptions: { current: 1, previous: 0 },
      activeCustomers: { current: 2, previous: 1 },
      newCustomers: { current: 2 },
      returningCustomers: { current: 1 },
      totalCustomers: 2,
      retentionRate: 1,
      retentionBase: 1,
    });
    expect(res.body.series).toHaveLength(30);
    expect(res.body.series.reduce((s: number, x: { stamps: number }) => s + x.stamps, 0)).toBe(5);
    expect(res.body.series.at(-1)).toMatchObject({ stamps: 5, redemptions: 1, activeCustomers: 2, newCustomers: 2 });
    expect(res.body.weekdays.reduce((s: number, x: { stamps: number }) => s + x.stamps, 0)).toBe(5);
    expect(res.body.devices[0]).toMatchObject({ name: 'Theke', stamps: 5 });
    expect(res.body.programs[0]).toMatchObject({ cards: 2, stamps: 5, redemptions: 1, completedCards: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/umsatz|revenue/i);

    const today = await m.client.get('/analytics/today');
    expect(today.body.today).toEqual({ stamps: 5, redemptions: 1, customers: 2 });

    const empty = await registerMerchant(t);
    const zero = await empty.client.get('/analytics/overview?days=7');
    expect(zero.body.kpis).toMatchObject({ stamps: { current: 0, previous: 0 }, retentionRate: null, totalCustomers: 0 });
  });

  it('Super-Admin-Bereich ist für Händler unsichtbar und für Betreiber voll nutzbar', async () => {
    const m = await registerMerchant(t, 'Autowäsche Blitz');
    for (const path of ['/admin/overview', '/admin/organizations', '/admin/users', '/admin/plans', '/admin/system', '/admin/errors', '/admin/abuse', '/admin/devices', '/admin/audit']) {
      expect((await m.client.get(path)).status).toBe(404);
    }
    expect((await m.client.patch('/admin/plans/starter', { priceMonthlyCents: 1 })).status).toBe(404);
    expect((await new Client(t).get('/admin/overview')).status).toBe(401);

    const admin = await registerMerchant(t, 'Tably Betrieb');
    await t.prisma.user.update({ where: { id: admin.userId }, data: { isSuperAdmin: true } });
    const overview = await admin.client.get('/admin/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.mrrCents).toBe(0);
    expect((await admin.client.get('/admin/system')).body).toMatchObject({ database: true, queueDriver: 'inline', mailMode: 'local', billingMode: 'local' });
    const orgs = await admin.client.get('/admin/organizations?q=Blitz');
    expect(orgs.body.total).toBe(1);

    // Tarifpreise und Limits zentral ändern
    const plan = await admin.client.patch('/admin/plans/starter', { priceMonthlyCents: 3500 });
    expect(plan.body.priceMonthlyCents).toBe(3500);
    expect((await new Client(t).get('/public/plans')).body.plans[0].priceMonthlyCents).toBe(3500);
    await admin.client.patch('/admin/plans/starter', { priceMonthlyCents: 2900 });

    // Individuelle Limits und Sperre
    const upd = await admin.client.patch(`/admin/organizations/${m.organizationId}`, { limitOverrides: { locations: 1 } });
    expect(upd.body.limits.locations).toBe(1);
    expect((await m.client.post('/organization/locations', { name: 'Zweite' })).body.error.code).toBe('limit_reached');
    await admin.client.patch(`/admin/organizations/${m.organizationId}`, { status: 'SUSPENDED', suspendedReason: 'Missbrauch' });
    expect((await m.client.patch('/organization', { name: 'X Y' })).body.error.code).toBe('organization_suspended');
    await admin.client.patch(`/admin/organizations/${m.organizationId}`, { status: 'ACTIVE' });

    // Benutzer sperren beendet dessen Sitzungen
    await admin.client.patch(`/admin/users/${m.userId}`, { disabled: true });
    expect((await m.client.get('/auth/me')).status).toBe(401);
    expect((await new Client(t).post('/auth/login', { email: m.email, password: m.password })).status).toBe(401);
    const audit = await admin.client.get('/admin/audit?q=admin.');
    expect(audit.body.items.every((i: { actorType: string }) => i.actorType === 'SUPER_ADMIN')).toBe(true);
    expect(audit.body.total).toBeGreaterThanOrEqual(5);
  });

  it('Kontaktformular speichert Anfragen und verwirft Bots', async () => {
    const anon = new Client(t);
    expect((await anon.post('/public/contact', { name: 'Kim Kunde', email: 'kim@example.com', message: 'Ich möchte einen Stempel bestellen.' })).status).toBe(200);
    expect((await anon.post('/public/contact', { name: 'Bot', email: 'bot@example.com', message: 'Spam Spam Spam Spam', website: 'http://spam' })).status).toBe(400);
    expect(await t.prisma.contactRequest.count()).toBe(1);
  });

  it('OpenAPI-Dokumentation wird ausgeliefert', async () => {
    const res = await new Client(t).get('/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(80);
    expect(res.body.paths['/public/taps'].post.requestBody.content['application/json'].schema.properties.e).toBeDefined();
  });
});

describe('Rate Limiting', () => {
  it('begrenzt Anmeldeversuche pro IP', async () => {
    process.env.TEST_RATE_LIMITS = 'true';
    const t = await createApp(NO_INTEGRATIONS);
    try {
      const client = new Client(t);
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) statuses.push((await client.post('/auth/login', { email: 'niemand@example.com', password: 'egal-egal-12' })).status);
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    } finally {
      delete process.env.TEST_RATE_LIMITS;
      await t.close();
    }
  });
});
