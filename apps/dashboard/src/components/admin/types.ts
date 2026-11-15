import type { PlanFeatures, PlanLimits } from '@tably/config';
import type { AuditEntryDto, BookingPolicy, DeviceKind, DeviceSecurity, DeviceStatus, InvoiceDto, LocationDto, OrganizationDto, ProgramStatus, Role, SubscriptionStatus, TransactionSource, TransactionType } from '@tably/types';

/** Antwortformate der Super-Admin-Routen (apps/api/src/modules/admin/admin.controller.ts). */
export type Provider = 'LOCAL' | 'STRIPE';

export interface AdminOverview {
  organizations: Partial<Record<'ACTIVE' | 'SUSPENDED', number>>;
  subscriptions: Array<{ status: SubscriptionStatus; provider: Provider; count: number }>;
  users: number;
  customers: number;
  activeCards: number;
  devices: Array<{ status: DeviceStatus; securityStatus: DeviceSecurity; count: number }>;
  stamps30d: { amount: number; bookings: number };
  flagged30d: number;
  errors24h: number;
  openContactRequests: number;
  mrrCents: number;
  mrrNote: string;
}

export interface AdminSystem {
  database: boolean;
  queueDriver: string;
  mailMode: 'smtp' | 'local' | string;
  billingMode: 'stripe' | 'local';
  integrations: { stripe: boolean; smtp: boolean; appleWallet: boolean; googleWallet: boolean; nfcSimulator: boolean };
  environment: string;
  urls: { web: string; dashboard: string; api: string };
}

export interface AdminOrgRow extends OrganizationDto {
  suspendedReason: string | null;
  subscription: { planId: string; status: SubscriptionStatus; provider: Provider; trialEndsAt: string | null; currentPeriodEnd: string | null } | null;
  _count: { customers: number; devices: number; members: number; programs: number };
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  limits: PlanLimits;
  features: PlanFeatures;
  stripePriceMonthlyId: string | null;
  stripePriceYearlyId: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
  _count?: { subscriptions: number };
}

export interface AdminOrgDetail {
  organization: OrganizationDto & {
    suspendedReason: string | null;
    subscription: {
      planId: string;
      status: SubscriptionStatus;
      interval: 'MONTH' | 'YEAR';
      provider: Provider;
      trialEndsAt: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      pastDueSince: string | null;
      limitOverrides: Partial<PlanLimits> | null;
      plan: AdminPlan;
    } | null;
    members: Array<{ id: string; role: Role; createdAt: string; user: { id: string; name: string; email: string; lastLoginAt: string | null; disabledAt: string | null } }>;
    locations: LocationDto[];
    programs: Array<{ id: string; name: string; status: ProgramStatus; type: string; bookingPolicy: BookingPolicy }>;
    devices: Array<{ id: string; name: string; kind: DeviceKind; status: DeviceStatus; securityStatus: DeviceSecurity; lastUsedAt: string | null; rejectedTaps: number }>;
  };
  usage: Record<keyof PlanLimits, number>;
  limits: PlanLimits;
  stamps30d: number;
  flagged30d: number;
  audit: AuditEntryDto[];
  invoices: InvoiceDto[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  emailVerifiedAt: string | null;
  totpEnabledAt: string | null;
  lastLoginAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  memberships: Array<{ role: Role; organization: { id: string; name: string } }>;
}

export interface AdminDeviceRow {
  id: string;
  publicId: string;
  name: string;
  kind: DeviceKind;
  status: DeviceStatus;
  securityStatus: DeviceSecurity;
  keyVersion: number;
  rejectedTaps: number;
  lastUsedAt: string | null;
  createdAt: string;
  organization: { id: string; name: string };
}

export interface AdminAbuse {
  items: Array<{ id: string; organizationId: string; organizationName: string | null; type: TransactionType; source: TransactionSource; amount: number; flagReason: string | null; note: string | null; createdAt: string }>;
  total: number;
  page: number;
  pageSize: number;
  byOrganization: Array<{ organizationId: string; name: string; flagged: number; total: number }>;
}

export interface AdminErrorRow {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminContactRequest {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: string | null;
  message: string;
  ip: string | null;
  handledAt: string | null;
  createdAt: string;
}

export const LIMIT_KEYS: Array<keyof PlanLimits> = ['locations', 'devices', 'programs', 'staff', 'customers', 'campaignsPerMonth'];
export const FEATURE_KEYS: Array<keyof PlanFeatures> = ['walletPasses', 'emailCampaigns', 'automations', 'advancedAnalytics', 'posApi', 'prioritySupport'];
