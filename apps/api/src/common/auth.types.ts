import type { Request } from 'express';
import type { Permission, Role } from '@tapperl/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
}

export interface AuthContext {
  sessionId: string;
  user: AuthUser;
  /** Aktive Organisation der Sitzung (null, solange keine gewählt ist) */
  organizationId: string | null;
  role: Role | null;
}

/** Garantiert vorhandener Mandantenkontext (nach PermissionGuard). */
export interface TenantContext {
  userId: string;
  organizationId: string;
  role: Role;
  ip: string | null;
  userAgent: string | null;
}

export interface CustomerBrowser {
  /** Hash des Browser-Tokens; null, wenn der Browser noch keines besitzt */
  tokenHash: string | null;
}

export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string;
  scopes: string[];
}

export interface AppRequest extends Request {
  auth?: AuthContext;
  tenant?: TenantContext;
  customerBrowser?: CustomerBrowser;
  apiKey?: ApiKeyContext;
  requiredPermission?: Permission;
  rawBody?: Buffer;
}

export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

export function userAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 300) : null;
}
