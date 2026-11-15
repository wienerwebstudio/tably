import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://tably:tably@localhost:5432/tably_test',
      QUEUE_DRIVER: 'inline',
      APP_ENCRYPTION_KEY: 'a1'.repeat(32),
      NFC_SIMULATOR_ENABLED: 'true',
      WEB_URL: 'http://localhost:3000',
      DASHBOARD_URL: 'http://localhost:3001',
      API_PUBLIC_URL: 'http://localhost:4000',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      SMTP_URL: '',
    },
  },
});
