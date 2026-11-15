import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Wendet die Migrationen einmalig auf die Test-Datenbank an. */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://tably:tably@localhost:5432/tably_test';
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '../../../packages/database'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
