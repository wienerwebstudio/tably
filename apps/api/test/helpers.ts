import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma.service';
import { resetEnvCache } from '../src/common/env';

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  close(): Promise<void>;
}

export async function createApp(env: Record<string, string> = {}): Promise<TestApp> {
  Object.assign(process.env, env);
  resetEnvCache();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), close: () => app.close() };
}

/** Leert alle Tabellen außer den Tarifen. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'Plan')`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

type Agent = ReturnType<typeof request.agent>;

/** Client mit Cookie-Jar, der den CSRF-Header automatisch mitsendet. */
export class Client {
  readonly agent: Agent;
  constructor(private readonly t: TestApp) {
    this.agent = request.agent(t.app.getHttpServer());
  }
  get(path: string) {
    return this.agent.get(path);
  }
  post(path: string, body?: unknown) {
    return this.agent.post(path).set('X-Tapperl-Request', '1').send(body as object);
  }
  patch(path: string, body?: unknown) {
    return this.agent.patch(path).set('X-Tapperl-Request', '1').send(body as object);
  }
  put(path: string, body?: unknown) {
    return this.agent.put(path).set('X-Tapperl-Request', '1').send(body as object);
  }
  delete(path: string) {
    return this.agent.delete(path).set('X-Tapperl-Request', '1');
  }
}

let counter = 0;
export const uniq = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface Merchant {
  client: Client;
  email: string;
  password: string;
  organizationId: string;
  userId: string;
  orgSlug: string;
}

/** Registriert einen Händler mit bestätigter E-Mail-Adresse. */
export async function registerMerchant(t: TestApp, name = 'Café Morgenrot'): Promise<Merchant> {
  const client = new Client(t);
  const email = `${uniq('owner')}@example.com`;
  const password = 'Sicheres-Passwort-123';
  const res = await client.post('/auth/register', { name: 'Olivia Owner', email, password, organizationName: name, acceptTerms: true });
  if (res.status !== 201) throw new Error(`Registrierung fehlgeschlagen: ${res.status} ${JSON.stringify(res.body)}`);
  await t.prisma.user.update({ where: { id: res.body.userId }, data: { emailVerifiedAt: new Date() } });
  const org = await t.prisma.organization.findUniqueOrThrow({ where: { id: res.body.organizationId } });
  return { client, email, password, organizationId: res.body.organizationId, userId: res.body.userId, orgSlug: org.slug };
}

export interface Program {
  id: string;
  slug: string;
  rewardId: string;
}

/** Legt ein veröffentlichtes Stempelprogramm an. */
export async function createProgram(m: Merchant, overrides: Record<string, unknown> = {}, stampsRequired = 5): Promise<Program> {
  const created = await m.client.post('/programs', { name: 'Kaffeekarte', cardTitle: 'Kaffeekarte', stampsRequired, stampIcon: 'coffee', reward: { name: 'Gratis Kaffee' } });
  if (created.status !== 201) throw new Error(`Programm: ${created.status} ${JSON.stringify(created.body)}`);
  const id = created.body.id as string;
  if (Object.keys(overrides).length) {
    const upd = await m.client.patch(`/programs/${id}`, overrides);
    if (upd.status !== 200) throw new Error(`Programm-Update: ${upd.status} ${JSON.stringify(upd.body)}`);
  }
  const pub = await m.client.put(`/programs/${id}/status`, { status: 'PUBLISHED' });
  if (pub.status !== 200) throw new Error(`Veröffentlichen: ${pub.status} ${JSON.stringify(pub.body)}`);
  return { id, slug: created.body.slug, rewardId: created.body.rewards[0].id };
}

export async function createSimDevice(m: Merchant, programId: string, extra: Record<string, unknown> = {}): Promise<{ id: string; publicId: string }> {
  const res = await m.client.post('/devices', { name: 'Theke', kind: 'SIMULATED', programId, ...extra });
  if (res.status !== 201) throw new Error(`Gerät: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.device.id, publicId: res.body.device.publicId };
}

/** Simulierter Tap: liefert die Parameter, die der Chip in die URL schreiben würde. */
export async function simulateTap(m: Merchant, deviceId: string): Promise<{ deviceId: string; e: string; c: string }> {
  const res = await m.client.post(`/devices/${deviceId}/simulate-tap`);
  if (res.status !== 200) throw new Error(`Simulation: ${res.status} ${JSON.stringify(res.body)}`);
  return { deviceId: res.body.deviceId, e: res.body.e, c: res.body.c };
}

/** Neuer Kunde (eigener Browser), der sich für ein Programm anmeldet. */
export async function enrollCustomer(t: TestApp, m: Merchant, program: Program, data: Record<string, unknown> = {}): Promise<{ client: Client; cardId: string }> {
  const client = new Client(t);
  const res = await client.post(`/public/programs/${m.orgSlug}/${program.slug}/enroll`, { firstName: 'Lena', acceptPrivacy: true, ...data });
  if (res.status !== 200) throw new Error(`Anmeldung: ${res.status} ${JSON.stringify(res.body)}`);
  return { client, cardId: res.body.cardId };
}
