import { expect, test } from '@playwright/test';
import { DASHBOARD, PASSWORD, registerMerchant, unique } from './helpers';

test.describe('Zugriffsschutz', () => {
  test('geschützte Seiten leiten zur Anmeldung und danach zurück zum Ziel', async ({ page }) => {
    await page.goto(`${DASHBOARD}/karten`);
    await page.waitForURL('**/login?next=%2Fkarten');
    await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
    await page.getByLabel('E-Mail-Adresse').fill('niemand@example.com');
    await page.getByLabel('Passwort').fill('falsches-passwort-1');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByText('E-Mail-Adresse oder Passwort ist falsch.')).toBeVisible();
  });

  test('Anmelden, Abmelden und Passwort zurücksetzen', async ({ page, context }) => {
    const { email } = await registerMerchant(page, `Laden ${unique('Login')}`);
    await page.goto(`${DASHBOARD}/`);
    await page.getByRole('button', { name: /Olivia Owner/ }).click();
    await page.getByRole('menuitem', { name: 'Abmelden' }).click();
    await page.waitForURL('**/login');

    await page.goto(`${DASHBOARD}/karten`);
    await page.waitForURL('**/login?next=%2Fkarten');
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.waitForURL('**/karten');
    await expect(page.getByRole('heading', { name: 'Treuekarten' })).toBeVisible();

    // Sitzungscookie ist für Skripte nicht lesbar
    const cookies = await context.cookies(DASHBOARD);
    const session = cookies.find((c) => c.name === 'tably_session');
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Lax');
    expect(await page.evaluate(() => document.cookie)).not.toContain('tably_session');
  });

  test('Plattformverwaltung ist für Händler nicht erreichbar', async ({ page }) => {
    await registerMerchant(page, `Laden ${unique('Admin')}`);
    const res = await page.request.get(`${DASHBOARD}/api/admin/overview`);
    expect(res.status()).toBe(404);
    await page.goto(`${DASHBOARD}/admin`);
    await expect(page.getByText('Plattformübersicht')).toHaveCount(0);
  });

  test('schreibende API-Aufrufe ohne Schutz-Header werden abgelehnt (CSRF)', async ({ page }) => {
    await registerMerchant(page, `Laden ${unique('Csrf')}`);
    const res = await page.request.patch(`${DASHBOARD}/api/organization`, { data: { name: 'Gekapert' } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('csrf_failed');
  });
});
