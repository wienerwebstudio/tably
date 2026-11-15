import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD, dashboardApi, registerMerchant, setupProgram, simulateTapUrl, unique, WEB, customerPhone } from './helpers';

/** Sammelt JavaScript-Fehler und fehlgeschlagene Serverantworten (5xx) einer Seite. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.url()}`));
  return problems;
}

test('Website: alle öffentlichen Seiten laden fehlerfrei, Kontaktformular funktioniert', async ({ page }) => {
  const problems = watch(page);
  // Pfad → erwarteter Seitentitel (aus den Metadaten)
  const pages: Array<[string, RegExp]> = [
    ['/', /Tapperl/],
    ['/funktionen', /Funktionen/],
    ['/branchen', /Branchen/],
    ['/hardware', /NFC-Stempel/],
    ['/preise', /Preise/],
    ['/faq', /Häufige Fragen/],
    ['/kontakt', /Kontakt/],
    ['/impressum', /Impressum/],
    ['/datenschutz', /Datenschutz/],
    ['/agb', /Geschäftsbedingungen/],
  ];
  for (const [path, text] of pages) {
    const res = await page.goto(`${WEB}${path}`);
    expect(res?.status(), path).toBe(200);
    await expect(page, path).toHaveTitle(text);
    await expect(page.locator('h1').first(), path).toBeVisible();
    // Kein horizontales Scrollen
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} Überlauf`).toBe(true);
  }
  // Preise stammen aus der zentralen Tarifkonfiguration
  await page.goto(`${WEB}/preise`);
  for (const plan of ['Starter', 'Business', 'Premium']) await expect(page.getByRole('heading', { name: plan }).first()).toBeVisible();
  await expect(page.getByText(/29\s?€/).first()).toBeVisible();

  await page.goto(`${WEB}/kontakt`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Kim Kunde');
  await page.getByRole('textbox', { name: /E-Mail/ }).fill('kim@example.com');
  await page.getByRole('textbox', { name: 'Nachricht' }).fill('Ich interessiere mich für einen Stempel für mein Café.');
  await page.getByRole('button', { name: /senden/i }).click();
  await expect(page.getByText(/Danke|erhalten|gesendet/i).first()).toBeVisible();

  expect((await page.goto(`${WEB}/gibt-es-nicht`))?.status()).toBe(404);
  expect(problems).toEqual([]);
});

test('Dashboard: alle Bereiche laden mit echten Daten; Stempel und Einlösung an der Theke', async ({ page, browser }) => {
  const problems = watch(page);
  await registerMerchant(page, `Café ${unique('Smoke')}`);
  const { program, deviceId } = await setupProgram(page);

  // Eine Kundin mit zwei Stempeln über den echten Tap-Weg
  const phone = await customerPhone(browser);
  await phone.page.goto(await simulateTapUrl(page, deviceId));
  await phone.page.getByLabel('Vorname').fill('Greta');
  await phone.page.getByRole('checkbox').first().check();
  await phone.page.getByRole('button', { name: /Karte anlegen/ }).click();
  await expect(phone.page.getByRole('heading', { name: 'Stempel erhalten!' })).toBeVisible();
  await phone.page.goto(await simulateTapUrl(page, deviceId));
  await expect(phone.page.getByRole('heading', { name: 'Stempel erhalten!' })).toBeVisible();
  await phone.page.getByRole('link', { name: 'Karte ansehen' }).click();
  const shortCode = (await phone.page.getByText(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/).first().textContent())!;

  await test.step('Theke: Karte suchen, dritten Stempel geben, Prämie einlösen', async () => {
    await page.goto(`${DASHBOARD}/theke`);
    await page.getByLabel('Kartencode').fill(shortCode.toLowerCase().replace('-', ''));
    await page.getByRole('button', { name: 'Suchen' }).click();
    await expect(page.getByText('Greta').first()).toBeVisible();
    await page.getByRole('button', { name: /Stempel geben/ }).click();
    await expect(page.getByText('Prämie bereit')).toBeVisible();
    // Die Kundenkarte aktualisiert sich ohne Zutun
    await phone.page.reload();
    await expect(phone.page.getByRole('article')).toContainText('3 / 3');
    await page.getByRole('button', { name: 'Gratis Kaffee: Einlösen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Jetzt einlösen' }).click();
    await expect(page.getByText('„Gratis Kaffee“ eingelöst. Neuer Stand: 0.').first()).toBeVisible();
  });
  await phone.context.close();

  const sections: Array<[string, string | RegExp]> = [
    ['/', /Hallo/],
    ['/kunden', 'Kunden'],
    ['/karten', 'Treuekarten'],
    [`/karten/${program.id}`, 'Kaffeekarte'],
    ['/stempel', /Stempel/],
    [`/stempel/${deviceId}`, 'Theke'],
    ['/buchungen', 'Buchungen'],
    ['/marketing', 'Marketing'],
    ['/marketing/neu', /Kampagne/],
    ['/analysen', 'Analysen'],
    ['/einstellungen', 'Einstellungen'],
    ['/einstellungen?tab=standorte', 'Einstellungen'],
    ['/einstellungen?tab=team', 'Einstellungen'],
    ['/einstellungen?tab=abo', 'Einstellungen'],
    ['/einstellungen?tab=sicherheit', 'Einstellungen'],
    ['/einstellungen?tab=integrationen', 'Einstellungen'],
    ['/einstellungen?tab=protokoll', 'Einstellungen'],
  ];
  for (const [path, heading] of sections) {
    await page.goto(`${DASHBOARD}${path}`);
    await expect(page.getByRole('heading', { level: 1 }), path).toContainText(heading);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Das hat nicht geklappt'), path).toHaveCount(0);
  }

  await test.step('Daten sind konsistent über die Bereiche', async () => {
    await page.goto(`${DASHBOARD}/kunden`);
    await expect(page.getByText('Greta').first()).toBeVisible();
    await page.goto(`${DASHBOARD}/buchungen`);
    await expect(page.getByText('Einlösung').first()).toBeVisible();
    await page.goto(`${DASHBOARD}/analysen`);
    await expect(page.getByText('Vergebene Stempel', { exact: true }).first().locator('..')).toContainText('3');
    const analytics = await dashboardApi<{ kpis: { stamps: { current: number }; redemptions: { current: number } } }>(page, 'GET', '/analytics/overview?days=7');
    expect(analytics.kpis).toMatchObject({ stamps: { current: 3 }, redemptions: { current: 1 } });
  });

  await test.step('Abo im Testmodus wechseln', async () => {
    await page.goto(`${DASHBOARD}/einstellungen?tab=abo`);
    await expect(page.getByText(/Testmodus/).first()).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('Super-Admin: Plattformverwaltung lädt alle Bereiche', async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD nicht gesetzt');
  const problems = watch(page);
  await page.goto(`${DASHBOARD}/login?next=/admin`);
  await page.getByLabel('E-Mail-Adresse').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Passwort').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/admin');
  for (const path of ['/admin', '/admin/betriebe', '/admin/benutzer', '/admin/hardware', '/admin/missbrauch', '/admin/tarife', '/admin/fehler', '/admin/anfragen', '/admin/protokoll']) {
    await page.goto(`${DASHBOARD}${path}`);
    await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Das hat nicht geklappt'), path).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});
