/**
 * Antwortformate der API, wie die Oberflächen sie verwenden.
 * (Datumswerte kommen als ISO-Strings über JSON.)
 */
import type { PlanFeatures, PlanLimits } from '@tapperl/config';
import type { CardDesign } from './schemas';
import type { Permission, Role } from './permissions';
import type { ErrorCode } from './errors';

export type ISODate = string;
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'RESTRICTED' | 'CANCELED';
export type ProgramStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
export type BookingPolicy = 'AUTO' | 'STAFF_CONFIRM' | 'POS_EVENT';
export type TransactionType = 'EARN' | 'REDEEM' | 'ADJUST' | 'REVERSAL';
export type TransactionSource = 'NFC_TAP' | 'SIMULATED_TAP' | 'ACTIVE_READER' | 'MANUAL' | 'POS' | 'CAMPAIGN' | 'SIGNUP_BONUS' | 'API';

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  industry: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  timezone: string;
  currency: string;
  brandColor: string;
  logoAssetId: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  onboardingCompletedAt: ISODate | null;
  createdAt: ISODate;
}

export interface MeDto {
  user: { id: string; email: string; name: string; isSuperAdmin: boolean; emailVerified: boolean; totpEnabled: boolean; locale: string };
  organization: OrganizationDto | null;
  role: Role | null;
  permissions: Permission[];
  subscription: { planId: string; planName: string; status: SubscriptionStatus; trialEndsAt: ISODate | null; writable: boolean; limits: PlanLimits; features: PlanFeatures } | null;
  memberships: Array<{ organizationId: string; role: Role; name: string; slug: string }>;
}

export interface LocationDto {
  id: string;
  name: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: ISODate;
  _count?: { devices: number };
}

export interface RewardDto {
  id: string;
  name: string;
  description: string;
  type: 'FREE_ITEM' | 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT' | 'CUSTOM';
  value: number | null;
  cost: number;
  isActive?: boolean;
  sortOrder?: number;
}

/** Öffentliche Sicht auf ein Programm (Anmeldeseite, Kartenvorschau). */
export interface ProgramViewDto {
  id: string;
  slug: string;
  type: string;
  status: ProgramStatus;
  name: string;
  cardTitle: string;
  description: string;
  stampsRequired: number;
  stampIcon: string;
  unitLabel: string;
  design: CardDesign;
  terms: string;
  validFrom: ISODate | null;
  validUntil: ISODate | null;
  signupBonus: number;
  logoUrl: string | null;
  organization: { name: string; slug: string };
  rewards: RewardDto[];
}

export interface ProgramDto {
  id: string;
  type: string;
  status: ProgramStatus;
  name: string;
  slug: string;
  cardTitle: string;
  description: string;
  stampsRequired: number;
  stampsPerTap: number;
  stampIcon: string;
  design: CardDesign;
  bookingPolicy: BookingPolicy;
  minIntervalMinutes: number;
  maxStampsPerDay: number;
  signupBonus: number;
  validFrom: ISODate | null;
  validUntil: ISODate | null;
  cardValidityDays: number | null;
  terms: string;
  publishedAt: ISODate | null;
  createdAt: ISODate;
  rewards: RewardDto[];
  cardCount: number;
  deviceCount: number;
  signupUrl: string;
  preview: ProgramViewDto;
}

export interface CustomerDto {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthday: ISODate | null;
  status: 'ACTIVE' | 'BLOCKED' | 'ANONYMIZED';
  source: string;
  note: string | null;
  lastActivityAt: ISODate | null;
  createdAt: ISODate;
}

export interface CustomerListItemDto extends CustomerDto {
  cards: Array<{ id: string; balance: number; shortCode: string; status: string; programId: string; visits: number; program: { name: string; stampsRequired: number } }>;
}

export interface TransactionDto {
  id: string;
  programId: string;
  cardId: string;
  customerId: string;
  locationId: string | null;
  deviceId: string | null;
  staffUserId: string | null;
  type: TransactionType;
  source: TransactionSource;
  amount: number;
  note: string | null;
  flagged: boolean;
  flagReason: string | null;
  reversesId: string | null;
  createdAt: ISODate;
  locationName?: string | null;
  deviceName?: string | null;
  staffName?: string | null;
}

export interface TransactionListItemDto extends TransactionDto {
  shortCode: string;
  programName: string;
  customer: { id: string; firstName: string; lastName: string | null };
}

export type ConsentState = Record<'TERMS' | 'PRIVACY' | 'MARKETING_EMAIL' | 'MARKETING_WALLET', { granted: boolean; at: ISODate } | null>;

export interface CustomerDetailDto {
  customer: CustomerDto;
  consents: ConsentState;
  notificationCount: number;
  cards: Array<{
    id: string;
    shortCode: string;
    status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
    balance: number;
    lifetimeEarned: number;
    lifetimeRedeemed: number;
    visits: number;
    lastStampAt: ISODate | null;
    createdAt: ISODate;
    wallets: Array<'APPLE' | 'GOOGLE'>;
    program: { id: string; name: string; stampsRequired: number; type: string; status: ProgramStatus };
    rewards: Array<{ id: string; name: string; cost: number; available: boolean }>;
  }>;
  transactions: TransactionDto[];
  redemptions: Array<{ id: string; rewardName: string; cost: number; completedAt: ISODate | null }>;
}

export interface CardLookupDto {
  cardId: string;
  shortCode: string;
  status: string;
  balance: number;
  lastStampAt: ISODate | null;
  customer: { id: string; firstName: string; lastName: string | null; status: string };
  program: { id: string; name: string; stampsRequired: number };
  rewards: Array<{ id: string; name: string; cost: number; available: boolean }>;
}

export type DeviceKind = 'PASSIVE_NTAG424' | 'SIMULATED' | 'ACTIVE_READER';
export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'LOST' | 'RETIRED';
export type DeviceSecurity = 'OK' | 'WARNING' | 'COMPROMISED';

export interface DeviceDto {
  id: string;
  publicId: string;
  name: string;
  kind: DeviceKind;
  status: DeviceStatus;
  securityStatus: DeviceSecurity;
  uidHex: string | null;
  keyVersion: number;
  lastCounter: number;
  policyOverride: BookingPolicy | null;
  rejectedTaps: number;
  lastUsedAt: ISODate | null;
  activatedAt: ISODate | null;
  createdAt: ISODate;
  locationId: string | null;
  programId: string | null;
  firmware: string | null;
  location: { id: string; name: string } | null;
  program: { id: string; name: string; bookingPolicy: BookingPolicy; status: ProgramStatus } | null;
  stamps7d?: number;
}

export interface DeviceDetailDto {
  device: DeviceDto;
  events: Array<{ id: string; type: string; detail: Record<string, unknown> | null; ip: string | null; createdAt: ISODate }>;
  taps30d: Record<string, number>;
  simulatorEnabled: boolean;
}

export interface PersonalizationDto {
  publicId: string;
  keyVersion: number;
  keys: { sdmMetaReadKey: string; sdmFileReadKey: string };
  profile: {
    urlTemplate: string;
    ndefUriPayload: string;
    uriPrefixCode: number;
    piccDataOffset: number;
    sdmMacOffset: number;
    sdmMacInputOffset: number;
    settings: Record<string, boolean | number>;
  } | null;
  warning: string | null;
}

export interface SimulatedTapDto {
  simulated: true;
  deviceId: string;
  e: string;
  c: string;
  counter: number;
  url: string;
}

export type TapOutcome = 'completed' | 'pending_approval' | 'pending_pos' | 'rejected' | 'needs_enrollment' | 'device_activated' | 'expired';
export interface TapResultDto {
  status: TapOutcome;
  tapToken?: string;
  simulated?: boolean;
  amount?: number;
  card?: { id: string; balance: number; stampsRequired: number; rewardReady: boolean; shortCode: string };
  program?: ProgramViewDto;
  code?: ErrorCode;
  message?: string;
  expiresAt?: ISODate;
}

export interface PendingTapDto {
  id: string;
  status: 'PENDING_APPROVAL' | 'PENDING_POS';
  simulated: boolean;
  createdAt: ISODate;
  expiresAt: ISODate;
  deviceName: string;
  locationName: string | null;
  customerName: string | null;
  card: { id: string; shortCode: string; balance: number; lastStampAt: ISODate | null; programName: string; stampsRequired: number } | null;
}

/** Karte, wie Kund:innen sie sehen. */
export interface CardViewDto {
  id: string;
  shortCode: string;
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
  balance: number;
  lifetimeEarned: number;
  visits: number;
  version: number;
  lastStampAt: ISODate | null;
  expiresAt: ISODate | null;
  createdAt: ISODate;
  customer: { firstName: string; email: string | null; birthday: ISODate | null; status: string };
  program: ProgramViewDto;
  rewards: Array<RewardDto & { available: boolean; missing: number }>;
  offers: Array<{ id: string; type: string; subject: string; body: string; endsAt: ISODate | null }>;
  history: Array<{ id: string; type: TransactionType; amount: number; note: string | null; createdAt: ISODate }>;
  pendingRedemption: { id: string; rewardName: string; codeExpiresAt: ISODate } | null;
  marketingConsent: boolean;
  wallet: { apple: boolean; google: boolean };
}

export interface MyCardDto {
  id: string;
  balance: number;
  status: string;
  organizationName: string;
  cardTitle: string;
  stampsRequired: number;
  stampIcon: string;
  design: CardDesign;
  logoUrl: string | null;
}

export interface PlanDto {
  id: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface InvoiceDto {
  id: string;
  number: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: ISODate | null;
  periodEnd: ISODate | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  isTest: boolean;
  createdAt: ISODate;
}

export interface BillingDto {
  mode: 'stripe' | 'local';
  subscription: {
    planId: string;
    status: SubscriptionStatus;
    interval: 'MONTH' | 'YEAR';
    provider: 'LOCAL' | 'STRIPE';
    trialEndsAt: ISODate | null;
    currentPeriodEnd: ISODate | null;
    cancelAtPeriodEnd: boolean;
    pastDueSince: ISODate | null;
    writable: boolean;
  };
  limits: PlanLimits;
  features: PlanFeatures;
  usage: Record<keyof PlanLimits, number>;
  plans: PlanDto[];
  invoices: InvoiceDto[];
}

export type CampaignType = 'ANNOUNCEMENT' | 'OFFER' | 'BIRTHDAY' | 'INACTIVITY' | 'BONUS_STAMPS';
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'FAILED';
export interface CampaignDto {
  id: string;
  programId: string | null;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  channels: Array<'EMAIL' | 'WALLET' | 'CARD'>;
  subject: string;
  body: string;
  segment: { programId: string | null; inactiveDays: number | null; activeDays: number | null; minBalance: number | null; rewardReady: boolean };
  config: { inactivityDays: number; bonusStamps: number; multiplier: number; weekdays: number[] };
  scheduledAt: ISODate | null;
  startsAt: ISODate | null;
  endsAt: ISODate | null;
  sentAt: ISODate | null;
  createdAt: ISODate;
  stats: { sent: number; sentTest: number; failed: number; skipped: number };
}
export interface CampaignDetailDto extends CampaignDto {
  mailMode: 'smtp' | 'local';
  notifications: Array<{ id: string; channel: string; status: string; recipient: string | null; error: string | null; createdAt: ISODate; sentAt: ISODate | null; customer: { id: string; firstName: string; lastName: string | null } | null }>;
}

export interface AnalyticsDto {
  range: { days: number; timezone: string };
  advanced: boolean;
  kpis: {
    stamps: { current: number; previous: number };
    bookings: { current: number; previous: number };
    redemptions: { current: number; previous: number };
    activeCustomers: { current: number; previous: number };
    newCustomers: { current: number; previous: number };
    returningCustomers: { current: number };
    totalCustomers: number;
    retentionRate: number | null;
    retentionBase: number;
  };
  series: Array<{ day: string; stamps: number; redemptions: number; activeCustomers: number; newCustomers: number }>;
  weekdays: Array<{ weekday: number; stamps: number }>;
  locations: Array<{ id: string | null; name: string; stamps: number; redemptions: number; activeCustomers: number }>;
  devices: Array<{ id: string; name: string; status: string; stamps: number; rejectedTaps: number; lastUsedAt: ISODate | null }>;
  programs: Array<{ id: string; name: string; cards: number; activeCards: number; stamps: number; redemptions: number; completedCards: number; averageBalance: number }>;
}

export interface TodayDto {
  today: { stamps: number; redemptions: number; customers: number };
  pendingTaps: number;
  flagged7d: number;
  recent: Array<{ id: string; type: TransactionType; source: TransactionSource; amount: number; createdAt: ISODate; flagged: boolean; customer: { id: string; firstName: string; lastName: string | null } }>;
}

export interface OnboardingDto {
  steps: Array<{ key: 'company' | 'program' | 'reward' | 'publish' | 'device' | 'test'; done: boolean }>;
  completed: boolean;
  programId: string | null;
  allDone: boolean;
}

export interface MemberDto {
  id: string;
  userId: string;
  role: Role;
  name: string;
  email: string;
  lastLoginAt: ISODate | null;
  totpEnabled: boolean;
  joinedAt: ISODate;
}
export interface MembersDto {
  members: MemberDto[];
  invitations: Array<{ id: string; email: string; role: Role; expiresAt: ISODate; createdAt: ISODate }>;
}

export interface AuditEntryDto {
  id: string;
  organizationId: string | null;
  actorType: string;
  actorId: string | null;
  actorName?: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: ISODate;
}

export interface WalletStatusDto {
  apple: { configured: boolean; passes: number };
  google: { configured: boolean; passes: number };
  passesWithErrors: number;
}
