import { loadEnv, type Env } from '@tapperl/config';

export const ENV = Symbol('ENV');
export type { Env };

let cached: Env | null = null;
export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}
export function resetEnvCache(): void {
  cached = null;
}
