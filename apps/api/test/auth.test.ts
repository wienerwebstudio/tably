import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totpCode } from '../src/common/crypto';
import { Client, createApp, registerMerchant, resetDb, uniq, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createApp();
  await resetDb(t.prisma);
});
afterAll(() => t.close());

const lastMail = (to: string, kind: string) => t.prisma.notification.findFirst({ where: { recipient: to, provider: { endsWith: kind } }, orderBy: { createdAt: 'desc' } });
const tokenFrom = (body: string) => /token=([A-Za-z0-9_-]+)/.exec(body)![1]!;

describe('Registrierung und Anmeldung', () => {
  it('legt Konto, Organisation, Standort und Testphase an', async () => {
    const m = await registerMerchant(t, 'Bäckerei Müller & Söhne');
    const me = await m.client.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('OWNER');
    expect(me.body.organization.slug).toBe('baeckerei-mueller-soehne');
    expect(me.body.subscription).toMatchObject({ status: 'TRIALING', planId: 'business', writable: true });
    expect(await t.prisma.location.count({ where: { organizationId: m.organizationId } })).toBe(1);
  });

  it('speichert Passwörter nur gehasht und Sitzungstokens nur als Hash', async () => {
    const m = await registerMerchant(t);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: m.userId } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    const session = await t.prisma.session.findFirstOrThrow({ where: { userId: m.userId } });
    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('setzt ein HttpOnly-Cookie mit SameSite=Lax', async () => {
    const client = new Client(t);
    const res = await client.post('/auth/register', { name: 'Test Person', email: `${uniq('c')}@example.com`, password: 'Sicheres-Passwort-123', organizationName: 'Testladen', acceptTerms: true });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('tably_session='))!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('lehnt schwache Passwörter und doppelte E-Mail-Adressen ab', async () => {
    const m = await registerMerchant(t);
    const client = new Client(t);
    const weak = await client.post('/auth/register', { name: 'Ab Cd', email: `${uniq('w')}@example.com`, password: 'kurz', organizationName: 'Laden', acceptTerms: true });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBeDefined();
    const dup = await client.post('/auth/register', { name: 'Ab Cd', email: m.email, password: 'Sicheres-Passwort-123', organizationName: 'Laden', acceptTerms: true });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('email_taken');
  });

  it('meldet an und ab; ohne Sitzung gibt es 401', async () => {
    const m = await registerMerchant(t);
    const client = new Client(t);
    expect((await client.get('/auth/me')).status).toBe(401);
    expect((await client.post('/auth/login', { email: m.email, password: 'falsch-falsch-1' })).status).toBe(401);
    expect((await client.post('/auth/login', { email: m.email, password: m.password })).status).toBe(200);
    expect((await client.get('/auth/me')).status).toBe(200);
    await client.post('/auth/logout');
    expect((await client.get('/auth/me')).status).toBe(401);
  });

  it('sperrt das Konto nach wiederholten Fehlversuchen', async () => {
    const m = await registerMerchant(t);
    const client = new Client(t);
    for (let i = 0; i < 8; i++) await client.post('/auth/login', { email: m.email, password: 'falsch-falsch-1' });
    const res = await client.post('/auth/login', { email: m.email, password: m.password });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('account_locked');
  });

  it('bestätigt die E-Mail-Adresse über den Link aus der Mail (lokaler Testmodus)', async () => {
    const client = new Client(t);
    const email = `${uniq('v')}@example.com`;
    await client.post('/auth/register', { name: 'Vera Verify', email, password: 'Sicheres-Passwort-123', organizationName: 'Blumen Vera', acceptTerms: true });
    const mail = await lastMail(email, 'auth.verify');
    expect(mail?.status).toBe('SENT_TEST');
    expect((await client.get('/auth/me')).body.user.emailVerified).toBe(false);
    const token = tokenFrom(mail!.body);
    expect((await client.post('/auth/verify-email', { token })).status).toBe(200);
    expect((await client.get('/auth/me')).body.user.emailVerified).toBe(true);
    expect((await client.post('/auth/verify-email', { token })).status).toBe(422);
  });

  it('setzt das Passwort zurück und beendet alle Sitzungen', async () => {
    const m = await registerMerchant(t);
    const anon = new Client(t);
    expect((await anon.post('/auth/forgot-password', { email: 'niemand@example.com' })).status).toBe(200);
    await anon.post('/auth/forgot-password', { email: m.email });
    const token = tokenFrom((await lastMail(m.email, 'auth.reset'))!.body);
    expect((await anon.post('/auth/reset-password', { token, password: 'Neues-Passwort-456' })).status).toBe(200);
    expect((await m.client.get('/auth/me')).status).toBe(401);
    expect((await anon.post('/auth/login', { email: m.email, password: m.password })).status).toBe(401);
    expect((await anon.post('/auth/login', { email: m.email, password: 'Neues-Passwort-456' })).status).toBe(200);
    expect((await anon.post('/auth/reset-password', { token, password: 'Noch-Ein-Passwort-7' })).status).toBe(422);
  });

  it('Zwei-Faktor-Anmeldung: ohne Code kein Zugriff', async () => {
    const m = await registerMerchant(t);
    const setup = await m.client.post('/auth/2fa/setup');
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');
    expect((await m.client.post('/auth/2fa/enable', { code: '000000' })).status).toBe(422);
    expect((await m.client.post('/auth/2fa/enable', { code: totpCode(setup.body.secret) })).status).toBe(200);

    const client = new Client(t);
    const login = await client.post('/auth/login', { email: m.email, password: m.password });
    expect(login.body.mfaRequired).toBe(true);
    expect((await client.get('/auth/me')).status).toBe(401);
    expect((await client.post('/auth/mfa', { code: '123456' })).status).toBe(401);
    expect((await client.post('/auth/mfa', { code: totpCode(setup.body.secret) })).status).toBe(200);
    expect((await client.get('/auth/me')).body.user.totpEnabled).toBe(true);
  });
});

describe('CSRF-Schutz', () => {
  it('lehnt schreibende Anfragen ohne Schutz-Header ab', async () => {
    const m = await registerMerchant(t);
    const res = await m.client.agent.patch('/organization').send({ name: 'Neu' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_failed');
  });
  it('lehnt fremde Origins ab', async () => {
    const m = await registerMerchant(t);
    const res = await m.client.agent.patch('/organization').set('X-Tably-Request', '1').set('Origin', 'https://boese.example').send({ name: 'Neu' });
    expect(res.status).toBe(403);
    const ok = await m.client.agent.patch('/organization').set('X-Tably-Request', '1').set('Origin', 'http://localhost:3001').send({ name: 'Neuer Name' });
    expect(ok.status).toBe(200);
  });
});

describe('Team und Rollen', () => {
  it('lädt Mitarbeitende ein; STAFF darf stempeln, aber nichts verwalten', async () => {
    const m = await registerMerchant(t);
    const staffEmail = `${uniq('staff')}@example.com`;
    expect((await m.client.post('/organization/invitations', { email: staffEmail, role: 'STAFF' })).status).toBe(201);
    const token = tokenFrom((await lastMail(staffEmail, 'team.invitation'))!.body);

    const staff = new Client(t);
    const info = await staff.get(`/auth/invitations/${token}`);
    expect(info.body).toMatchObject({ email: staffEmail, role: 'STAFF', userExists: false });
    const accept = await staff.post('/auth/invitations/accept', { token, name: 'Stefan Staff', password: 'Sicheres-Passwort-123' });
    expect(accept.body.needsLogin).toBe(false);
    const me = await staff.get('/auth/me');
    expect(me.body.role).toBe('STAFF');
    expect(me.body.permissions).toEqual(['customers.read', 'stamps.grant']);

    expect((await staff.get('/customers')).status).toBe(200);
    expect((await staff.patch('/organization', { name: 'Gekapert' })).status).toBe(403);
    expect((await staff.get('/organization/members')).status).toBe(403);
    expect((await staff.post('/programs', { name: 'X', cardTitle: 'X' })).status).toBe(403);
    expect((await staff.get('/billing')).status).toBe(200);
    expect((await staff.post('/billing/change-plan', { planId: 'premium', interval: 'MONTH' })).status).toBe(403);
    expect((await staff.get('/analytics/overview')).status).toBe(403);
    expect((await staff.get('/customers/export.csv')).status).toBe(403);
  });

  it('ADMIN darf keine ADMIN-Rolle vergeben und die Inhaberrolle nicht ändern', async () => {
    const m = await registerMerchant(t);
    const adminEmail = `${uniq('admin')}@example.com`;
    await m.client.post('/organization/invitations', { email: adminEmail, role: 'ADMIN' });
    const admin = new Client(t);
    await admin.post('/auth/invitations/accept', { token: tokenFrom((await lastMail(adminEmail, 'team.invitation'))!.body), name: 'Anna Admin', password: 'Sicheres-Passwort-123' });
    expect((await admin.post('/organization/invitations', { email: `${uniq('x')}@example.com`, role: 'ADMIN' })).status).toBe(403);
    expect((await admin.post('/organization/invitations', { email: `${uniq('x')}@example.com`, role: 'MANAGER' })).status).toBe(201);
    const members = await admin.get('/organization/members');
    const owner = members.body.members.find((x: { role: string }) => x.role === 'OWNER');
    expect((await admin.patch(`/organization/members/${owner.id}`, { role: 'STAFF' })).status).toBe(403);
    expect((await admin.delete(`/organization/members/${owner.id}`)).status).toBe(403);
  });

  it('entzogene Mitgliedschaft wirkt sofort auf laufende Sitzungen', async () => {
    const m = await registerMerchant(t);
    const email = `${uniq('gone')}@example.com`;
    await m.client.post('/organization/invitations', { email, role: 'MANAGER' });
    const manager = new Client(t);
    await manager.post('/auth/invitations/accept', { token: tokenFrom((await lastMail(email, 'team.invitation'))!.body), name: 'Mia Manager', password: 'Sicheres-Passwort-123' });
    expect((await manager.get('/programs')).status).toBe(200);
    const members = await m.client.get('/organization/members');
    const member = members.body.members.find((x: { email: string }) => x.email === email);
    expect((await m.client.delete(`/organization/members/${member.id}`)).status).toBe(200);
    expect((await manager.get('/programs')).status).toBe(403);
  });
});
