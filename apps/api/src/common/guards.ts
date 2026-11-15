import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';
import { CUSTOMER_COOKIE, SESSION_COOKIE } from '@tapperl/config';
import { can, type Permission } from '@tapperl/types';
import { AppError, forbidden } from './errors';
import { SessionService } from './session.service';
import { PrismaService } from './prisma.service';
import { EntitlementsService } from './entitlements.service';
import { clientIp, userAgent, type AppRequest, type AuthContext, type CustomerBrowser, type TenantContext, type ApiKeyContext } from './auth.types';
import { hashToken } from './crypto';

const PERMISSION_KEY = 'tapperl:permission';
const ALLOW_RESTRICTED_KEY = 'tapperl:allowRestricted';
const SCOPE_KEY = 'tapperl:scope';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const auth = await this.sessions.resolve(req.cookies?.[SESSION_COOKIE]);
    if (!auth) throw new AppError('unauthenticated', 'Bitte melde dich an.');
    req.auth = auth;
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const auth = req.auth;
    if (!auth) throw new AppError('unauthenticated', 'Bitte melde dich an.');
    if (!auth.organizationId || !auth.role) throw forbidden('Du gehörst keiner Organisation an.');
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (permission && !can(auth.role, permission)) throw forbidden();

    const org = await this.prisma.organization.findUnique({ where: { id: auth.organizationId }, select: { status: true } });
    if (!org) throw forbidden();
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (org.status === 'SUSPENDED' && mutating) {
      throw new AppError('organization_suspended', 'Dieses Konto wurde gesperrt. Bitte wende dich an den Support.');
    }
    const allowRestricted = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_RESTRICTED_KEY, [context.getHandler(), context.getClass()]);
    if (mutating && !allowRestricted) await this.entitlements.assertWritable(auth.organizationId);

    req.tenant = { userId: auth.user.id, organizationId: auth.organizationId, role: auth.role, ip: clientIp(req), userAgent: userAgent(req) };
    return true;
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    // Bewusst 404 statt 403: die Existenz des Admin-Bereichs wird nicht verraten.
    if (!req.auth?.user.isSuperAdmin) throw new AppError('not_found', 'Nicht gefunden.');
    return true;
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const header = req.headers.authorization;
    const key = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!key || !key.startsWith('tapperl_')) throw new AppError('unauthenticated', 'API-Schlüssel fehlt.');
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash: hashToken(key) }, include: { organization: { select: { status: true } } } });
    if (!record || record.revokedAt) throw new AppError('unauthenticated', 'API-Schlüssel ungültig.');
    if (record.organization.status !== 'ACTIVE') throw new AppError('organization_suspended', 'Konto gesperrt.');
    const scope = this.reflector.getAllAndOverride<string | undefined>(SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (scope && !record.scopes.includes(scope)) throw forbidden('Dem API-Schlüssel fehlt die Berechtigung.');
    await this.entitlements.assertWritable(record.organizationId);
    await this.entitlements.assertFeature(record.organizationId, 'posApi', 'Die Kassen-Schnittstelle');
    if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
      await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    req.apiKey = { apiKeyId: record.id, organizationId: record.organizationId, scopes: record.scopes };
    return true;
  }
}

/** Nur angemeldet (ohne Mandanten- oder Rechteprüfung). */
export const Authenticated = () => applyDecorators(UseGuards(SessionGuard), ApiCookieAuth());

/** Angemeldet, Mitglied der aktiven Organisation und im Besitz der Berechtigung. */
export const Can = (permission: Permission, opts: { allowRestricted?: boolean } = {}) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permission),
    SetMetadata(ALLOW_RESTRICTED_KEY, opts.allowRestricted ?? false),
    UseGuards(SessionGuard, PermissionGuard),
    ApiCookieAuth(),
  );

/** Mitglied der aktiven Organisation, ohne bestimmte Berechtigung. */
export const Member = (opts: { allowRestricted?: boolean } = {}) =>
  applyDecorators(SetMetadata(ALLOW_RESTRICTED_KEY, opts.allowRestricted ?? false), UseGuards(SessionGuard, PermissionGuard), ApiCookieAuth());

export const SuperAdmin = () => applyDecorators(UseGuards(SessionGuard, SuperAdminGuard), ApiCookieAuth());

export const ApiKeyAuth = (scope: string) => applyDecorators(SetMetadata(SCOPE_KEY, scope), UseGuards(ApiKeyGuard), ApiSecurity('apiKey'));

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const auth = ctx.switchToHttp().getRequest<AppRequest>().auth;
  if (!auth) throw new AppError('unauthenticated', 'Bitte melde dich an.');
  return auth;
});

export const Tenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const tenant = ctx.switchToHttp().getRequest<AppRequest>().tenant;
  if (!tenant) throw new AppError('internal_error', 'Mandantenkontext fehlt.');
  return tenant;
});

export const ApiKeyCtx = createParamDecorator((_: unknown, ctx: ExecutionContext): ApiKeyContext => {
  const key = ctx.switchToHttp().getRequest<AppRequest>().apiKey;
  if (!key) throw new AppError('unauthenticated', 'API-Schlüssel fehlt.');
  return key;
});

/** Browser-Token des Kunden (falls vorhanden). */
export const Browser = createParamDecorator((_: unknown, ctx: ExecutionContext): CustomerBrowser => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  const token = req.cookies?.[CUSTOMER_COOKIE] as string | undefined;
  return { tokenHash: token && token.length >= 20 ? hashToken(token) : null };
});
