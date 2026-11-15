import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { devices } from '@playwright/test';

export const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
export const DASHBOARD = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001';
export const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
export const PASSWORD = 'Sicheres-Passwort-123';

/** Liest den Link aus der jüngsten Mail im lokalen Testpostfach. */
export async function mailLink(page: Page, to: string, kind: string): Promise<string> {
  await expect
    .poll(async () => {
      const res = await page.request.get(`${API}/dev/mailbox?to=${encodeURIComponent(to)}`);
      const mails = (await res.json()) as Array<{ provider: string; body: string }>;
      return mails.find((m) => m.provider.endsWith(kind))?.body ?? null;
    }, { message: `Mail „${kind}“ an ${to}` })
    .not.toBeNull();
  const res = await page.request.get(`${API}/dev/mailbox?to=${encodeURIComponent(to)}`);
  const mails = (await res.json()) as Array<{ provider: string; body: string }>;
  const body = mails.find((m) => m.provider.endsWith(kind))!.body;
  return /https?:\/\/\S+/.exec(body)![0];
}

/** Dashboard-API im Kontext der angemeldeten Seite aufrufen (für Testvorbereitung). */
export async function dashboardApi<T>(page: Page, method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, data?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await page.request.fetch(`${DASHBOARD}/api${path}`, { method, data, headers: { 'X-Tapperl-Request': '1', ...headers } });
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Registriert einen Händler über die Oberfläche und bestätigt die E-Mail-Adresse. */
export async function registerMerchant(page: Page, company: string): Promise<{ email: string }> {
  const email = `${unique('owner')}@example.com`;
  await page.goto(`${DASHBOARD}/register`);
  await page.getByLabel('Name deines Betriebs').fill(company);
  await page.getByLabel('Dein Name').fill('Olivia Owner');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await page.waitForURL('**/onboarding');
  const link = await mailLink(page, email, 'auth.verify');
  const verify = await page.context().newPage();
  await verify.goto(link);
  await expect(verify.getByText('Deine E-Mail-Adresse ist bestätigt')).toBeVisible();
  await verify.close();
  return { email };
}

/** Richtet per API ein veröffentlichtes Programm mit simuliertem Stempel ein. */
export async function setupProgram(page: Page, overrides: Record<string, unknown> = {}) {
  const program = await dashboardApi<{ id: string; slug: string; signupUrl: string; rewards: Array<{ id: string }> }>(page, 'POST', '/programs', { name: 'Kaffeekarte', cardTitle: 'Kaffeekarte', stampsRequired: 3, stampIcon: 'coffee', reward: { name: 'Gratis Kaffee' } });
  await dashboardApi(page, 'PATCH', `/programs/${program.id}`, { minIntervalMinutes: 0, maxStampsPerDay: 50, ...overrides });
  await dashboardApi(page, 'PUT', `/programs/${program.id}/status`, { status: 'PUBLISHED' });
  const device = await dashboardApi<{ device: { id: string } }>(page, 'POST', '/devices', { name: 'Theke', kind: 'SIMULATED', programId: program.id });
  return { program, deviceId: device.device.id };
}

export async function simulateTapUrl(page: Page, deviceId: string): Promise<string> {
  return (await dashboardApi<{ url: string }>(page, 'POST', `/devices/${deviceId}/simulate-tap`)).url;
}

export async function customerPhone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'de-DE' });
  return { context, page: await context.newPage() };
}
