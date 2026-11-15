import { Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { CUSTOMER_COOKIE, CUSTOMER_SESSION_TTL_DAYS, SESSION_COOKIE, SESSION_TTL_DAYS } from '@tably/config';
import type { Role } from '@tably/types';
import { ENV, type Env } from './env';
import { PrismaService } from './prisma.service';
import { hashToken, randomToken } from './crypto';
import type { AuthContext } from './auth.types';

const DAY = 86_400_000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private cookieOptions(maxAgeMs: number) {
    return { httpOnly: true, secure: this.env.COOKIE_SECURE, sameSite: 'lax' as const, path: '/', maxAge: maxAgeMs };
  }

  async create(res: Response, input: { userId: string; organizationId: string | null; mfaPending: boolean; ip: string | null; userAgent: string | null }): Promise<string> {
    const token = randomToken();
    const session = await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: input.userId,
        organizationId: input.organizationId,
        mfaPending: input.mfaPending,
        ip: input.ip,
        userAgent: input.userAgent,
        expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * DAY),
      },
    });
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(SESSION_TTL_DAYS * DAY));
    return session.id;
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Lädt die Sitzung zum Cookie. `allowMfaPending` nur für den 2FA-Schritt. */
  async resolve(token: string | undefined, allowMfaPending = false): Promise<AuthContext | null> {
    if (!token || token.length < 20) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.disabledAt) return null;
    if (session.mfaPending && !allowMfaPending) return null;

    let role: Role | null = null;
    let organizationId = session.organizationId;
    if (organizationId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.userId } },
      });
      if (member) role = member.role;
      else organizationId = null; // Mitgliedschaft wurde entzogen
    }
    // Gleitende Verlängerung, höchstens einmal pro Stunde schreiben
    if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
      await this.prisma.session
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * DAY) } })
        .catch(() => undefined);
    }
    return {
      sessionId: session.id,
      organizationId,
      role,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        isSuperAdmin: session.user.isSuperAdmin,
        emailVerified: Boolean(session.user.emailVerifiedAt),
      },
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  // ── Kunden-Browser ────────────────────────────────────────────────────
  /** Stellt sicher, dass der Browser ein Token besitzt, und gibt dessen Hash zurück. */
  ensureCustomerToken(res: Response, existingToken: string | undefined): string {
    if (existingToken && existingToken.length >= 20) return hashToken(existingToken);
    const token = randomToken();
    res.cookie(CUSTOMER_COOKIE, token, this.cookieOptions(CUSTOMER_SESSION_TTL_DAYS * DAY));
    return hashToken(token);
  }

  async linkCustomer(tokenHash: string, organizationId: string, customerId: string, userAgent: string | null): Promise<void> {
    const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_DAYS * DAY);
    await this.prisma.customerSession.upsert({
      where: { tokenHash_organizationId: { tokenHash, organizationId } },
      create: { tokenHash, organizationId, customerId, userAgent, expiresAt },
      update: { customerId, userAgent, expiresAt, lastSeenAt: new Date() },
    });
  }

  async customerFor(tokenHash: string | null, organizationId: string): Promise<string | null> {
    if (!tokenHash) return null;
    const session = await this.prisma.customerSession.findUnique({ where: { tokenHash_organizationId: { tokenHash, organizationId } } });
    if (!session || session.expiresAt < new Date()) return null;
    return session.customerId;
  }
}
