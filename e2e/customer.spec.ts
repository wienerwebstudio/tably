import { expect, test } from '@playwright/test';
import { customerPhone, dashboardApi, registerMerchant, setupProgram, simulateTapUrl, unique, WEB } from './helpers';

test.describe('Kundenkarte', () => {
  test('Anmeldung über den Link, Stempel sammeln, Prämie per Code einlösen', async ({ page, browser }) => {
    await registerMerchant(page, `Café ${unique('Karte')}`);
    const { program, deviceId } = await setupProgram(page);
    const phone = await customerPhone(browser);
    const p = phone.page;

    await test.step('Anmeldung mit Validierung', async () => {
      await p.goto(program.signupUrl);
      await expect(p.getByRole('heading', { name: /Deine Treuekarte bei/ })).toBeVisible();
      await p.getByRole('button', { name: 'Karte anlegen' }).click();
      await expect(p.getByText('Bitte prüfe die markierten Felder.')).toBeVisible();
      await p.getByLabel('Vorname').fill('Mara');
      await p.getByLabel('E-Mail-Adresse').fill(`${unique('mara')}@example.com`);
      await p.getByRole('checkbox').first().check();
      await p.getByRole('button', { name: 'Karte anlegen' }).click();
      await expect(p.getByText('Deine Karte ist bereit')).toBeVisible();
      await expect(p.getByRole('article')).toContainText('0 / 3');
    });

    await test.step('Drei Taps füllen die Karte', async () => {
      for (let i = 1; i <= 3; i++) {
        await p.goto(await simulateTapUrl(page, deviceId));
        await expect(p.getByRole('heading', { name: 'Stempel erhalten!' })).toBeVisible();
        await expect(p.getByRole('article')).toContainText(`${i} / 3`);
      }
      await expect(p.getByText('Deine Prämie ist einlösbar!')).toBeVisible();
    });

    await test.step('Code erzeugen – Stand bleibt bis zur Bestätigung', async () => {
      await p.getByRole('link', { name: 'Prämie einlösen' }).click();
      await p.getByRole('button', { name: 'Einlösen' }).click();
      await expect(p.getByText('Zeig diesen Code an der Theke')).toBeVisible();
      await expect(p.getByRole('article')).toContainText('3 / 3');
    });

    await test.step('Team bestätigt den Code, Karte aktualisiert sich von selbst', async () => {
      const label = await p.getByLabel(/^Code /).getAttribute('aria-label');
      const code = label!.replace(/\D/g, '');
      expect(code).toHaveLength(6);
      const wrong = code === '000000' ? '111111' : '000000';
      await expect(dashboardApi(page, 'POST', '/stamps/redeem-code', { code: wrong })).rejects.toThrow(/code_invalid/);
      const result = await dashboardApi<{ rewardName: string; balance: number }>(page, 'POST', '/stamps/redeem-code', { code });
      expect(result).toMatchObject({ rewardName: 'Gratis Kaffee', balance: 0 });
      await expect(p.getByText('Eingelöst – lass es dir schmecken!')).toBeVisible();
      await expect(p.getByRole('article')).toContainText('0 / 3');
      await expect(p.getByText('Prämie eingelöst: Gratis Kaffee')).toBeVisible();
    });

    await test.step('Karte ist nur in diesem Browser sichtbar', async () => {
      const cardUrl = p.url().split('?')[0]!;
      const stranger = await customerPhone(browser);
      await stranger.page.goto(cardUrl);
      await expect(stranger.page.getByText('Karte nicht gefunden')).toBeVisible();
      await stranger.context.close();
    });

    await test.step('Einwilligung ändern und Daten löschen', async () => {
      await p.getByRole('button', { name: 'Meine Daten' }).click();
      await p.getByRole('switch', { name: 'Angebote und Neuigkeiten' }).click();
      await p.getByRole('button', { name: 'Speichern' }).click();
      await expect(p.getByText('Gespeichert')).toBeVisible();
      await p.getByRole('button', { name: 'Meine Daten' }).click();
      await p.getByRole('button', { name: 'Karte und Daten löschen' }).click();
      await p.getByRole('button', { name: 'Endgültig löschen' }).click();
      await p.waitForURL('**/karten');
      await expect(p.getByText('Auf diesem Gerät sind noch keine Karten')).toBeVisible();
      const customers = await dashboardApi<{ total: number }>(page, 'GET', '/customers');
      expect(customers.total).toBe(0);
    });
    await phone.context.close();
  });

  test('Freigabe durch das Team: Kunde wartet, bis freigegeben wird', async ({ page, browser }) => {
    await registerMerchant(page, `Salon ${unique('Freigabe')}`);
    const { program, deviceId } = await setupProgram(page, { bookingPolicy: 'STAFF_CONFIRM' });
    const phone = await customerPhone(browser);
    const p = phone.page;
    await p.goto(program.signupUrl);
    await p.getByLabel('Vorname').fill('Jonas');
    await p.getByRole('checkbox').first().check();
    await p.getByRole('button', { name: 'Karte anlegen' }).click();
    await expect(p.getByText('Deine Karte ist bereit')).toBeVisible();

    await p.goto(await simulateTapUrl(page, deviceId));
    await expect(p.getByRole('heading', { name: 'Fast geschafft' })).toBeVisible();
    const pending = await dashboardApi<Array<{ id: string; customerName: string }>>(page, 'GET', '/taps/pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.customerName).toBe('Jonas');
    await dashboardApi(page, 'POST', `/taps/${pending[0]!.id}/decision`, { decision: 'APPROVE' });
    await expect(p.getByRole('heading', { name: 'Stempel erhalten!' })).toBeVisible();
    await phone.context.close();
  });

  test('Ungültige und unvollständige Tap-Links werden verständlich abgewiesen', async ({ browser }) => {
    const phone = await customerPhone(browser);
    await phone.page.goto(`${WEB}/t/st_gibtesnicht?e=${'A'.repeat(32)}&c=${'B'.repeat(16)}`);
    await expect(phone.page.getByText('Dieser Tap konnte nicht bestätigt werden')).toBeVisible();
    await phone.page.goto(`${WEB}/t/st_gibtesnicht`);
    await expect(phone.page.getByText('Der Link ist unvollständig')).toBeVisible();
    await phone.page.goto(`${WEB}/j/gibt-es-nicht/auch-nicht`);
    await expect(phone.page.getByText('Diese Treuekarte gibt es nicht')).toBeVisible();
    await phone.context.close();
  });
});
