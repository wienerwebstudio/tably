import { z } from 'zod';
import { INDUSTRIES } from '@tapperl/config';

const trimmed = (max: number, min = 1) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    // undefined bleibt undefined (Feld nicht gesendet = nicht ändern); leerer Text wird zu null
    .transform((v) => (v === undefined ? undefined : v ? v : null));
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(10, 'Mindestens 10 Zeichen')
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Mindestens ein Buchstabe und eine Ziffer');
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Farbe als #RRGGBB');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTime = z.coerce.date();

// ── Auth ────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: trimmed(80, 2),
  email: emailSchema,
  password: passwordSchema,
  organizationName: trimmed(80, 2),
  acceptTerms: z.literal(true, { message: 'Bitte akzeptiere die Nutzungsbedingungen.' }),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });
export const updateProfileSchema = z.object({ name: trimmed(80, 2) });
export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  name: trimmed(80, 2).optional(),
  password: passwordSchema.optional(),
});

// ── Organisation ────────────────────────────────────────────────────────
export const updateOrganizationSchema = z.object({
  name: trimmed(80, 2).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  email: emailSchema.optional().nullable(),
  phone: optionalText(40),
  website: optionalText(200),
  addressLine: optionalText(120),
  postalCode: optionalText(12),
  city: optionalText(80),
  country: z.string().length(2).toUpperCase().optional(),
  timezone: z.string().max(60).optional(),
  currency: z.enum(['EUR', 'CHF', 'GBP', 'USD']).optional(),
  brandColor: hexColor.optional(),
});
export const locationUpdateSchema = z.object({
  name: trimmed(80).optional(),
  addressLine: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(12).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});
export const locationSchema = z.object({
  name: trimmed(80),
  addressLine: optionalText(120),
  postalCode: optionalText(12),
  city: optionalText(80),
  isActive: z.boolean().optional(),
});
export const inviteMemberSchema = z.object({ email: emailSchema, role: z.enum(['ADMIN', 'MANAGER', 'STAFF']) });
export const updateMemberSchema = z.object({ role: z.enum(['ADMIN', 'MANAGER', 'STAFF']) });

// ── Programme ───────────────────────────────────────────────────────────
export const PROGRAM_TYPES = ['STAMP', 'POINTS', 'CASHBACK', 'MEMBERSHIP', 'DISCOUNT', 'COUPON', 'VIP', 'PREPAID'] as const;
/** Kartentypen, die bereits vollständig implementiert sind. */
export const AVAILABLE_PROGRAM_TYPES = ['STAMP', 'POINTS'] as const;
export const STAMP_ICONS = ['coffee', 'croissant', 'utensils', 'scissors', 'sparkles', 'dumbbell', 'flower', 'shopping-bag', 'car', 'star', 'heart', 'check'] as const;
export const BOOKING_POLICIES = ['AUTO', 'STAFF_CONFIRM', 'POS_EVENT'] as const;

export const cardDesignSchema = z.object({
  backgroundColor: hexColor.default('#1F3A2E'),
  textColor: hexColor.default('#FFFFFF'),
  accentColor: hexColor.default('#E8B86D'),
  logoAssetId: z.string().max(40).nullable().default(null),
  showLogo: z.boolean().default(true),
  rewardText: z.string().trim().max(80).default(''),
  footerText: z.string().trim().max(120).default(''),
});
export type CardDesign = z.infer<typeof cardDesignSchema>;
/** Teilaktualisierung – bewusst ohne Standardwerte, damit fehlende Felder nichts überschreiben. */
export const cardDesignUpdateSchema = z.object({
  backgroundColor: hexColor.optional(),
  textColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  logoAssetId: z.string().max(40).nullable().optional(),
  showLogo: z.boolean().optional(),
  rewardText: z.string().trim().max(80).optional(),
  footerText: z.string().trim().max(120).optional(),
});

export const rewardInputSchema = z.object({
  name: trimmed(60),
  description: z.string().trim().max(200).default(''),
  type: z.enum(['FREE_ITEM', 'DISCOUNT_PERCENT', 'DISCOUNT_AMOUNT', 'CUSTOM']).default('FREE_ITEM'),
  value: z.number().int().min(0).max(1_000_000).nullable().default(null),
  cost: z.number().int().min(1).max(100_000),
  isActive: z.boolean().default(true),
});

export const rewardUpdateSchema = z.object({
  name: trimmed(60).optional(),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['FREE_ITEM', 'DISCOUNT_PERCENT', 'DISCOUNT_AMOUNT', 'CUSTOM']).optional(),
  value: z.number().int().min(0).max(1_000_000).nullable().optional(),
  cost: z.number().int().min(1).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export const createProgramSchema = z.object({
  type: z.enum(AVAILABLE_PROGRAM_TYPES).default('STAMP'),
  name: trimmed(60),
  cardTitle: trimmed(40),
  description: z.string().trim().max(300).default(''),
  stampsRequired: z.number().int().min(2).max(30).default(10),
  stampIcon: z.enum(STAMP_ICONS).default('coffee'),
  design: cardDesignSchema.optional(),
  reward: rewardInputSchema.pick({ name: true, description: true }).optional(),
});

export const updateProgramSchema = z.object({
  name: trimmed(60).optional(),
  cardTitle: trimmed(40).optional(),
  description: z.string().trim().max(300).optional(),
  stampsRequired: z.number().int().min(2).max(30).optional(),
  stampsPerTap: z.number().int().min(1).max(100).optional(),
  stampIcon: z.enum(STAMP_ICONS).optional(),
  design: cardDesignUpdateSchema.optional(),
  bookingPolicy: z.enum(BOOKING_POLICIES).optional(),
  minIntervalMinutes: z.number().int().min(0).max(10_080).optional(),
  maxStampsPerDay: z.number().int().min(1).max(100).optional(),
  signupBonus: z.number().int().min(0).max(100).optional(),
  validFrom: dateTime.nullable().optional(),
  validUntil: dateTime.nullable().optional(),
  cardValidityDays: z.number().int().min(30).max(3650).nullable().optional(),
  terms: z.string().trim().max(2000).optional(),
});
export const programStatusSchema = z.object({ status: z.enum(['PUBLISHED', 'PAUSED', 'ARCHIVED']) });

// ── Kunden ──────────────────────────────────────────────────────────────
export const enrollSchema = z.object({
  firstName: trimmed(60),
  lastName: optionalText(60),
  email: emailSchema.optional().nullable().or(z.literal('').transform(() => null)),
  birthday: isoDate.optional().nullable().or(z.literal('').transform(() => null)),
  acceptPrivacy: z.literal(true, { message: 'Bitte stimme der Datenschutzerklärung zu.' }),
  marketingConsent: z.boolean().default(false),
  /** Optional: direkt einen offenen Tap einlösen */
  tapToken: z.string().max(200).optional(),
});
export const customerUpdateSchema = z.object({
  firstName: trimmed(60).optional(),
  lastName: optionalText(60),
  email: emailSchema.optional().nullable(),
  phone: optionalText(40),
  birthday: isoDate.optional().nullable(),
  note: optionalText(500),
  status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
});
export const customerCreateSchema = z.object({
  firstName: trimmed(60),
  lastName: optionalText(60),
  email: emailSchema.optional().nullable(),
  phone: optionalText(40),
  birthday: isoDate.optional().nullable(),
  programId: z.string().min(1).max(40),
});
export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED', 'ANONYMIZED']).optional(),
  programId: z.string().max(40).optional(),
  activity: z.enum(['active30', 'inactive60', 'reward_ready', 'new30']).optional(),
  sort: z.enum(['recent', 'name', 'created']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const consentUpdateSchema = z.object({
  type: z.enum(['MARKETING_EMAIL', 'MARKETING_WALLET']),
  granted: z.boolean(),
});
export const customerSelfUpdateSchema = z.object({
  firstName: trimmed(60).optional(),
  email: emailSchema.optional().nullable().or(z.literal('').transform(() => null)),
  birthday: isoDate.optional().nullable().or(z.literal('').transform(() => null)),
  marketingConsent: z.boolean().optional(),
});
export const cardRecoverySchema = z.object({ email: emailSchema });

// ── Buchungen ───────────────────────────────────────────────────────────
export const manualStampSchema = z.object({
  cardId: z.string().min(1).max(40),
  amount: z.number().int().min(1).max(50).default(1),
  locationId: z.string().max(40).optional().nullable(),
  note: optionalText(200),
});
export const adjustSchema = z.object({
  cardId: z.string().min(1).max(40),
  delta: z.number().int().min(-10_000).max(10_000).refine((v) => v !== 0, 'Darf nicht 0 sein'),
  note: trimmed(200, 3),
});
export const redeemSchema = z.object({
  cardId: z.string().min(1).max(40),
  rewardId: z.string().min(1).max(40),
  locationId: z.string().max(40).optional().nullable(),
});
export const redeemCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Sechsstelliger Code'),
  locationId: z.string().max(40).optional().nullable(),
});
export const customerRedeemRequestSchema = z.object({ rewardId: z.string().min(1).max(40) });
export const tapDecisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']) });

// ── NFC ─────────────────────────────────────────────────────────────────
export const createDeviceSchema = z.object({
  name: trimmed(60),
  kind: z.enum(['PASSIVE_NTAG424', 'SIMULATED']),
  locationId: z.string().max(40).optional().nullable(),
  programId: z.string().max(40).optional().nullable(),
});
export const updateDeviceSchema = z.object({
  name: trimmed(60).optional(),
  locationId: z.string().max(40).nullable().optional(),
  programId: z.string().max(40).nullable().optional(),
  policyOverride: z.enum(BOOKING_POLICIES).nullable().optional(),
});
export const deviceStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED', 'LOST', 'RETIRED']),
  reason: optionalText(200),
});
export const tapSchema = z.object({
  deviceId: z.string().min(4).max(40),
  e: z.string().regex(/^[0-9a-fA-F]{32}$/),
  c: z.string().regex(/^[0-9a-fA-F]{16}$/),
});
export const tapClaimSchema = z.object({ tapToken: z.string().min(20).max(200) });

// ── POS / API ───────────────────────────────────────────────────────────
export const posEventSchema = z.object({
  externalId: trimmed(120),
  locationId: z.string().max(40).optional().nullable(),
  amountCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  currency: z.string().length(3).toUpperCase().optional().nullable(),
  occurredAt: dateTime.optional(),
});
export const createApiKeySchema = z.object({ name: trimmed(60) });

// ── Marketing ───────────────────────────────────────────────────────────
export const segmentSchema = z.object({
  programId: z.string().max(40).nullable().default(null),
  /** Kunden ohne Aktivität seit mindestens n Tagen */
  inactiveDays: z.number().int().min(1).max(730).nullable().default(null),
  /** Kunden mit Aktivität in den letzten n Tagen */
  activeDays: z.number().int().min(1).max(730).nullable().default(null),
  minBalance: z.number().int().min(0).max(100_000).nullable().default(null),
  rewardReady: z.boolean().default(false),
});
export type Segment = z.infer<typeof segmentSchema>;

export const campaignConfigSchema = z.object({
  /** INACTIVITY: Auslöser nach n Tagen ohne Besuch */
  inactivityDays: z.number().int().min(7).max(365).default(45),
  /** BIRTHDAY / INACTIVITY / BONUS: geschenkte Stempel */
  bonusStamps: z.number().int().min(0).max(50).default(0),
  /** BONUS_STAMPS: Multiplikator für jede Buchung im Aktionszeitraum */
  multiplier: z.number().int().min(1).max(5).default(2),
  /** BONUS_STAMPS: Wochentage 0 (So) – 6 (Sa); leer = jeden Tag */
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
});
export type CampaignConfig = z.infer<typeof campaignConfigSchema>;

export const CAMPAIGN_CHANNELS = ['EMAIL', 'WALLET', 'CARD'] as const;
export const campaignInputSchema = z.object({
  name: trimmed(80),
  type: z.enum(['ANNOUNCEMENT', 'OFFER', 'BIRTHDAY', 'INACTIVITY', 'BONUS_STAMPS']),
  programId: z.string().max(40).nullable().optional(),
  channels: z.array(z.enum(CAMPAIGN_CHANNELS)).min(1).max(3),
  subject: z.string().trim().max(120).default(''),
  body: z.string().trim().max(2000).default(''),
  segment: segmentSchema.optional(),
  config: campaignConfigSchema.optional(),
  scheduledAt: dateTime.nullable().optional(),
  startsAt: dateTime.nullable().optional(),
  endsAt: dateTime.nullable().optional(),
});

// ── Abrechnung ──────────────────────────────────────────────────────────
export const changePlanSchema = z.object({
  planId: z.enum(['starter', 'business', 'premium']),
  interval: z.enum(['MONTH', 'YEAR']),
});

// ── Öffentlich ──────────────────────────────────────────────────────────
export const contactSchema = z.object({
  name: trimmed(80, 2),
  email: emailSchema,
  company: optionalText(80),
  topic: optionalText(60),
  message: trimmed(3000, 10),
  /** Honeypot – muss leer bleiben */
  website: z.string().max(0).optional(),
});

// ── Super-Admin ─────────────────────────────────────────────────────────
const limitValue = z.number().int().min(-1).max(10_000_000);
export const planLimitsSchema = z.object({
  locations: limitValue,
  devices: limitValue,
  programs: limitValue,
  staff: limitValue,
  customers: limitValue,
  campaignsPerMonth: limitValue,
});
export const planFeaturesSchema = z.object({
  walletPasses: z.boolean(),
  emailCampaigns: z.boolean(),
  automations: z.boolean(),
  advancedAnalytics: z.boolean(),
  posApi: z.boolean(),
  prioritySupport: z.boolean(),
});
export const adminUpdatePlanSchema = z.object({
  name: trimmed(40).optional(),
  description: z.string().trim().max(200).optional(),
  priceMonthlyCents: z.number().int().min(0).max(10_000_000).optional(),
  priceYearlyCents: z.number().int().min(0).max(100_000_000).optional(),
  limits: planLimitsSchema.optional(),
  features: planFeaturesSchema.optional(),
  stripePriceMonthlyId: optionalText(80),
  stripePriceYearlyId: optionalText(80),
  isActive: z.boolean().optional(),
});
export const adminOrgUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  suspendedReason: optionalText(200),
  planId: z.enum(['starter', 'business', 'premium']).optional(),
  subscriptionStatus: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'RESTRICTED', 'CANCELED']).optional(),
  trialEndsAt: dateTime.nullable().optional(),
  limitOverrides: planLimitsSchema.partial().nullable().optional(),
});
export const adminUserUpdateSchema = z.object({ disabled: z.boolean() });
export const paginationSchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
