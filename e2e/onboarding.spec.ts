import { expect, test } from '@playwright/test';
import { customerPhone, DASHBOARD, mailLink, PASSWORD, unique } from './helpers';

test('Händler richtet sich ein und vergibt den ersten Stempel', async ({ page, browser }) => {
  const email = `${unique('owner')}@example.com`;
  const company = `Café ${unique('E2E')}`;

  await test.step('Registrierung', async () => {
    await page.goto(`${DASHBOARD}/register`);
    await page.getByLabel('Name deines Betriebs').fill(company);
    await page.getByLabel('Dein Name').fill('Olivia Owner');
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Passwort').fill('kurz');
    await page.getByRole('button', { name: 'Konto erstellen' }).click();
    await expect(page.getByText('Mindestens 10 Zeichen').last()).toBeVisible();
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Konto erstellen' }).click();
    await page.waitForURL('**/onboarding');
  });

  await test.step('Betrieb', async () => {
    await expect(page.getByRole('heading', { name: 'Erzähl uns von deinem Betrieb' })).toBeVisible();
    await page.getByRole('radio', { name: 'Bäckerei' }).click();
    await page.getByLabel('Ort').fill('Graz');
    await page.getByRole('button', { name: 'Weiter' }).click();
  });

  await test.step('Karte gestalten', async () => {
    await expect(page.getByRole('heading', { name: 'Gestalte deine Treuekarte' })).toBeVisible();
    // Vorschlag passend zur Branche
    await expect(page.getByLabel('Titel auf der Karte')).toHaveValue('Brotkarte');
    await page.getByLabel('Prämie für eine volle Karte').fill('Gratis Croissant');
    await page.getByLabel('Stempel bis zur Prämie').fill('5');
    await expect(page.getByRole('article')).toContainText('Gratis Croissant');
    await page.getByRole('button', { name: 'Weiter' }).click();
  });

  await test.step('Veröffentlichen erst nach bestätigter E-Mail', async () => {
    await expect(page.getByRole('heading', { name: 'Karte veröffentlichen' })).toBeVisible();
    await expect(page.getByText('Bitte bestätige zuerst deine E-Mail-Adresse')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jetzt veröffentlichen' })).toBeDisabled();
    const verify = await page.context().newPage();
    await verify.goto(await mailLink(page, email, 'auth.verify'));
    await expect(verify.getByText('Deine E-Mail-Adresse ist bestätigt')).toBeVisible();
    await verify.close();
    await page.getByRole('button', { name: 'Ich habe bestätigt' }).click();
    await page.getByRole('button', { name: 'Jetzt veröffentlichen' }).click();
  });

  await test.step('Stempel registrieren (Simulation)', async () => {
    await expect(page.getByRole('heading', { name: 'Deinen Stempel registrieren' })).toBeVisible();
    await page.getByRole('radio', { name: /Erst ohne Hardware ausprobieren/ }).click();
    await page.getByRole('button', { name: 'Stempel registrieren' }).click();
  });

  await test.step('Erster Stempel über das Kundenhandy', async () => {
    await expect(page.getByRole('heading', { name: 'Der erste Stempel' })).toBeVisible();
    await page.getByRole('button', { name: 'Tap simulieren' }).click();
    const tapUrl = await page.getByRole('link', { name: 'Auf diesem Gerät öffnen' }).getAttribute('href');
    expect(tapUrl).toMatch(/\/t\/st_[A-Za-z0-9]+\?e=[0-9A-F]{32}&c=[0-9A-F]{16}$/);

    const phone = await customerPhone(browser);
    await phone.page.goto(tapUrl!);
    await expect(phone.page.getByRole('heading', { name: 'Noch ein Schritt' })).toBeVisible();
    await expect(phone.page.getByText('Simulation')).toBeVisible();
    await phone.page.getByLabel('Vorname').fill('Lena');
    await phone.page.getByRole('checkbox').first().check();
    await phone.page.getByRole('button', { name: 'Karte anlegen und Stempel sichern' }).click();
    await expect(phone.page.getByRole('heading', { name: 'Stempel erhalten!' })).toBeVisible();
    await expect(phone.page.getByText('Noch 4 bis zu deiner Prämie.')).toBeVisible();

    // Dieselbe URL ist für andere wertlos
    const thief = await customerPhone(browser);
    await thief.page.goto(tapUrl!);
    await expect(thief.page.getByText('Dieser Tap wurde bereits verwendet')).toBeVisible();
    await thief.context.close();
    await phone.context.close();

    await expect(page.getByText('Geschafft – der erste Stempel ist vergeben!')).toBeVisible();
    await page.getByRole('button', { name: 'Zum Dashboard' }).click();
  });

  await test.step('Dashboard zeigt den Stempel', async () => {
    await expect(page.getByRole('heading', { name: 'Hallo Olivia' })).toBeVisible();
    await expect(page.getByText('Stempel heute').locator('..')).toContainText('1');
    await expect(page.getByRole('link', { name: 'Lena' })).toBeVisible();
    await expect(page.getByText('Einrichtung fortsetzen')).toHaveCount(0);
  });
});
