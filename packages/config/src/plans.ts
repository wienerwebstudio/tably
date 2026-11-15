/**
 * Zentrale Tarifkonfiguration.
 *
 * Diese Werte sind die Standardwerte, mit denen die Tabelle `Plan` beim Seed
 * befüllt wird. Zur Laufzeit gilt immer der Datenbankstand – Preise und Limits
 * können also im Super-Admin-Panel geändert werden, ohne neu zu deployen.
 * Preise sind vorläufig (Stand MVP).
 */
export type PlanId = 'starter' | 'business' | 'premium';

export interface PlanLimits {
  /** -1 = unbegrenzt */
  locations: number;
  devices: number;
  programs: number;
  staff: number;
  customers: number;
  campaignsPerMonth: number;
}

export interface PlanFeatures {
  walletPasses: boolean;
  emailCampaigns: boolean;
  automations: boolean;
  advancedAnalytics: boolean;
  posApi: boolean;
  prioritySupport: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceMonthlyCents: number;
  /** Preis für 12 Monate bei jährlicher Zahlung */
  priceYearlyCents: number;
  currency: 'EUR';
  limits: PlanLimits;
  features: PlanFeatures;
  sortOrder: number;
}

export const UNLIMITED = -1;

export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Für einzelne Standorte, die ihre Papier-Stempelkarte ablösen wollen.',
    priceMonthlyCents: 2900,
    priceYearlyCents: 29000,
    currency: 'EUR',
    limits: { locations: 1, devices: 2, programs: 1, staff: 3, customers: 500, campaignsPerMonth: 2 },
    features: {
      walletPasses: true,
      emailCampaigns: false,
      automations: false,
      advancedAnalytics: false,
      posApi: false,
      prioritySupport: false,
    },
    sortOrder: 1,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Für wachsende Betriebe mit mehreren Mitarbeitenden und Marketing.',
    priceMonthlyCents: 5900,
    priceYearlyCents: 59000,
    currency: 'EUR',
    limits: { locations: 3, devices: 6, programs: 3, staff: 10, customers: 5000, campaignsPerMonth: 10 },
    features: {
      walletPasses: true,
      emailCampaigns: true,
      automations: true,
      advancedAnalytics: true,
      posApi: false,
      prioritySupport: false,
    },
    sortOrder: 2,
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Für Filialisten: unbegrenzte Kunden, Kassen-Schnittstelle und Priorität im Support.',
    priceMonthlyCents: 9900,
    priceYearlyCents: 99000,
    currency: 'EUR',
    limits: {
      locations: 10,
      devices: 25,
      programs: 10,
      staff: 50,
      customers: UNLIMITED,
      campaignsPerMonth: UNLIMITED,
    },
    features: {
      walletPasses: true,
      emailCampaigns: true,
      automations: true,
      advancedAnalytics: true,
      posApi: true,
      prioritySupport: true,
    },
    sortOrder: 3,
  },
];

/** Dauer der kostenlosen Testphase in Tagen. */
export const TRIAL_DAYS = 14;
/** Tarif, dessen Limits während der Testphase gelten. */
export const TRIAL_PLAN_ID: PlanId = 'business';
/** Kulanzzeit nach fehlgeschlagener Zahlung, bevor das Konto eingeschränkt wird. */
export const PAST_DUE_GRACE_DAYS = 7;

export function isWithinLimit(limit: number, current: number): boolean {
  return limit === UNLIMITED || current < limit;
}
