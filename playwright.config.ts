import { defineConfig, devices } from '@playwright/test';

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const DASHBOARD = process.env.E2E_DASHBOARD_URL ?? 'http://localhost:3001';
const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

/**
 * End-to-End-Tests gegen die laufenden Dienste (API, Website, Dashboard).
 * Voraussetzungen: PostgreSQL + Redis, `.env` mit NFC_SIMULATOR_ENABLED=true,
 * kein SMTP (lokales Testpostfach). Lokal starten die Dienste bei Bedarf selbst.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'off', screenshot: 'only-on-failure', locale: 'de-DE' },
  metadata: { WEB, DASHBOARD, API },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : [
        { command: 'pnpm --filter @tapperl/api start', url: `${API}/health`, reuseExistingServer: true, timeout: 60_000 },
        { command: 'pnpm --filter @tapperl/web start', url: WEB, reuseExistingServer: true, timeout: 60_000 },
        { command: 'pnpm --filter @tapperl/dashboard start', url: `${DASHBOARD}/login`, reuseExistingServer: true, timeout: 60_000 },
      ],
});
