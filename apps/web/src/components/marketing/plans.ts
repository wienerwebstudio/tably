import { DEFAULT_PLANS, TRIAL_DAYS, type PlanDefinition } from '@tapperl/config';

export type PublicPlan = Pick<PlanDefinition, 'id' | 'name' | 'description' | 'priceMonthlyCents' | 'priceYearlyCents' | 'currency' | 'limits' | 'features'>;

export interface PlansResult {
  plans: PublicPlan[];
  trialDays: number;
  /** false, wenn die API nicht erreichbar war und die Standardwerte gezeigt werden */
  live: boolean;
}

function isPlan(value: unknown): value is PublicPlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string' && typeof p.priceMonthlyCents === 'number' && typeof p.priceYearlyCents === 'number' && typeof p.limits === 'object' && p.limits !== null && typeof p.features === 'object' && p.features !== null;
}

/** Tarife aus der API; bei Fehlern die Standardwerte aus @tapperl/config. */
export async function getPlans(): Promise<PlansResult> {
  const fallback: PlansResult = { plans: [...DEFAULT_PLANS].sort((a, b) => a.sortOrder - b.sortOrder), trialDays: TRIAL_DAYS, live: false };
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/public/plans`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { plans?: unknown; trialDays?: unknown };
    if (!Array.isArray(json.plans) || json.plans.length === 0 || !json.plans.every(isPlan)) return fallback;
    return { plans: json.plans, trialDays: typeof json.trialDays === 'number' ? json.trialDays : TRIAL_DAYS, live: true };
  } catch {
    return fallback;
  }
}
