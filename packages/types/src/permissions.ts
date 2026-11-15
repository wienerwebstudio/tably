export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'org.manage',
  'billing.manage',
  'members.manage',
  'locations.manage',
  'programs.manage',
  'devices.manage',
  'customers.read',
  'customers.manage',
  'customers.export',
  'stamps.grant',
  'stamps.adjust',
  'analytics.read',
  'campaigns.manage',
  'audit.read',
  'apikeys.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== 'billing.manage'),
  MANAGER: [
    'programs.manage',
    'devices.manage',
    'customers.read',
    'customers.manage',
    'stamps.grant',
    'stamps.adjust',
    'analytics.read',
    'campaigns.manage',
  ],
  STAFF: ['customers.read', 'stamps.grant'],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Rollen, die eine Person mit `actor` vergeben oder verändern darf. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'OWNER') return ['ADMIN', 'MANAGER', 'STAFF'];
  if (actor === 'ADMIN') return ['MANAGER', 'STAFF'];
  return [];
}
