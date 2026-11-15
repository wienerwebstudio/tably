import { Inject, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { Response } from 'express';
import type { z } from 'zod';
import { TRIAL_DAYS, TRIAL_PLAN_ID } from '@tably/config';
import { ROLE_PERMISSIONS, type acceptInvitationSchema, type registerSchema } from '@tably/types';
import { ENV, type Env } from '../../common/env';
import { PrismaService, isUniqueViolation } from '../../common/prisma.service';
import { SessionService } from '../../common/session.service';
import { AuditService } from '../../common/audit.service';
import { MailService } from '../../common/mail.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { AppError } from '../../common/errors';
import { base32Encode, decryptSecret, encryptSecret, hashToken, randomToken, verifyTotp } from '../../common/crypto';
import { addDays, slugify } from '../../common/util';
import type { AuthContext } from '../../common/auth.types';
import { randomBytes } from 'node:crypto';

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly entitlements: EntitlementsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Wird für nicht existierende Konten geprüft, damit die Antwortzeit keine Konten verrät. */
  private dummyHash: Promise<string> | null = null;

  hashPassword(password: string): Promise<string> {
    return hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  private async uniqueOrgSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
      const exists = await this.prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }

  async register(input: z.infer<typeof registerSchema>, meta: RequestMeta, res: Response) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new AppError('email_taken', 'Für diese E-Mail-Adresse gibt es bereits ein Konto.', { fields: { email: 'Bereits registriert' } });
    const passwordHash = await this.hashPassword(input.password);
    const slug = await this.uniqueOrgSlug(input.organizationName);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
        const organization = await tx.organization.create({
          data: {
            name: input.organizationName,
            slug,
            email: input.email,
            members: { create: { userId: user.id, role: 'OWNER' } },
            locations: { create: { name: 'Hauptstandort' } },
            subscription: { create: { planId: TRIAL_PLAN_ID, status: 'TRIALING', trialEndsAt: addDays(new Date(), TRIAL_DAYS) } },
          },
        });
        return { user, organization };
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError('email_taken', 'Für diese E-Mail-Adresse gibt es bereits ein Konto.');
      throw err;
    }
    await this.sendVerification(result.user.id, result.user.email, result.user.name);
    await this.sessions.create(res, { userId: result.user.id, organizationId: result.organization.id, mfaPending: false, ...meta });
    await this.audit.log({ organizationId: result.organization.id, actorType: 'USER', actorId: result.user.id, action: 'auth.register', ...meta });
    return { userId: result.user.id, organizationId: result.organization.id };
  }

  async sendVerification(userId: string, email: string, name: string): Promise<void> {
    const token = randomToken();
    await this.prisma.authToken.deleteMany({ where: { userId, type: 'EMAIL_VERIFY', usedAt: null } });
    await this.prisma.authToken.create({ data: { userId, type: 'EMAIL_VERIFY', tokenHash: hashToken(token), expiresAt: addDays(new Date(), 2) } });
    await this.mail.send({
      to: email,
      kind: 'auth.verify',
      subject: 'Bitte bestätige deine E-Mail-Adresse',
      text: `Hallo ${name},\n\nbitte bestätige deine E-Mail-Adresse für Tably:\n${this.env.DASHBOARD_URL}/verify-email?token=${token}\n\nDer Link ist 48 Stunden gültig.`,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.type !== 'EMAIL_VERIFY' || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('token_invalid', 'Dieser Link ist ungültig oder abgelaufen.');
    }
    await this.prisma.$transaction([
      this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
  }

  async login(email: string, password: string, meta: RequestMeta, res: Response): Promise<{ mfaRequired: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.dummyHash ??= this.hashPassword('tably-dummy-password');
      await verify(await this.dummyHash, password).catch(() => false);
      throw new AppError('invalid_credentials', 'E-Mail-Adresse oder Passwort ist falsch.');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('account_locked', 'Zu viele Fehlversuche. Bitte versuche es in einigen Minuten erneut.');
    }
    const ok = await verify(user.passwordHash, password).catch(() => false);
    if (!ok || user.disabledAt) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      if (lock) await this.audit.log({ actorType: 'USER', actorId: user.id, action: 'auth.locked', ...meta });
      throw new AppError('invalid_credentials', 'E-Mail-Adresse oder Passwort ist falsch.');
    }
    const membership = await this.prisma.organizationMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    const mfaRequired = Boolean(user.totpEnabledAt);
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.sessions.create(res, { userId: user.id, organizationId: membership?.organizationId ?? null, mfaPending: mfaRequired, ...meta });
    await this.audit.log({ organizationId: membership?.organizationId, actorType: 'USER', actorId: user.id, action: 'auth.login', metadata: { mfaRequired }, ...meta });
    return { mfaRequired };
  }

  async completeMfa(sessionToken: string | undefined, code: string): Promise<void> {
    const auth = await this.sessions.resolve(sessionToken, true);
    if (!auth) throw new AppError('unauthenticated', 'Bitte melde dich erneut an.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!user.totpSecretEnc || !verifyTotp(decryptSecret(user.totpSecretEnc).toString(), code)) {
      await this.audit.log({ actorType: 'USER', actorId: user.id, action: 'auth.mfa_failed' });
      throw new AppError('mfa_invalid', 'Der Code ist nicht korrekt.');
    }
    await this.prisma.session.update({ where: { id: auth.sessionId }, data: { mfaPending: false } });
  }

  async me(auth: AuthContext) {
    const [memberships, user] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: { userId: auth.user.id },
        include: { organization: { select: { id: true, name: true, slug: true, logoAssetId: true, status: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { totpEnabledAt: true, locale: true } }),
    ]);
    let organization = null;
    let subscription = null;
    if (auth.organizationId) {
      organization = await this.prisma.organization.findUnique({ where: { id: auth.organizationId } });
      const eff = await this.entitlements.get(auth.organizationId);
      subscription = {
        planId: eff.plan.id,
        planName: eff.plan.name,
        status: eff.subscription.status,
        trialEndsAt: eff.subscription.trialEndsAt,
        writable: eff.writable,
        limits: eff.limits,
        features: eff.features,
      };
    }
    return {
      user: { ...auth.user, totpEnabled: Boolean(user.totpEnabledAt), locale: user.locale },
      organization,
      role: auth.role,
      permissions: auth.role ? ROLE_PERMISSIONS[auth.role] : [],
      subscription,
      memberships: memberships.map((m) => ({ organizationId: m.organizationId, role: m.role, name: m.organization.name, slug: m.organization.slug })),
    };
  }

  async switchOrganization(auth: AuthContext, organizationId: string): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: auth.user.id } } });
    if (!member) throw new AppError('not_found', 'Organisation nicht gefunden.');
    await this.prisma.session.update({ where: { id: auth.sessionId }, data: { organizationId } });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.disabledAt) return; // keine Auskunft, ob das Konto existiert
    const token = randomToken();
    await this.prisma.authToken.deleteMany({ where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null } });
    await this.prisma.authToken.create({ data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
    await this.mail.send({
      to: user.email,
      kind: 'auth.reset',
      subject: 'Passwort zurücksetzen',
      text: `Hallo ${user.name},\n\nüber diesen Link kannst du ein neues Passwort festlegen:\n${this.env.DASHBOARD_URL}/reset-password?token=${token}\n\nDer Link ist eine Stunde gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.type !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('token_invalid', 'Dieser Link ist ungültig oder abgelaufen.');
    }
    const passwordHash = await this.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Der Link kam per E-Mail an – die Adresse gilt damit als bestätigt.
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null, emailVerifiedAt: new Date() } }),
    ]);
    await this.sessions.revokeAllForUser(record.userId);
    await this.audit.log({ actorType: 'USER', actorId: record.userId, action: 'auth.password_reset' });
  }

  async changePassword(auth: AuthContext, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!(await verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw new AppError('invalid_credentials', 'Das aktuelle Passwort ist falsch.', { fields: { currentPassword: 'Falsches Passwort' }, status: 422 });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hashPassword(newPassword) } });
    await this.sessions.revokeAllForUser(user.id, auth.sessionId);
    await this.audit.log({ organizationId: auth.organizationId, actorType: 'USER', actorId: user.id, action: 'auth.password_changed' });
  }

  // ── Zwei-Faktor-Authentifizierung ─────────────────────────────────────
  async setupTotp(auth: AuthContext): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (user.totpEnabledAt) throw new AppError('conflict', 'Die Zwei-Faktor-Anmeldung ist bereits aktiv.');
    const secret = base32Encode(randomBytes(20));
    await this.prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: encryptSecret(secret) } });
    const label = encodeURIComponent(`Tably:${user.email}`);
    return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=Tably&algorithm=SHA1&digits=6&period=30` };
  }

  async enableTotp(auth: AuthContext, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!user.totpSecretEnc || !verifyTotp(decryptSecret(user.totpSecretEnc).toString(), code)) {
      throw new AppError('mfa_invalid', 'Der Code ist nicht korrekt.', { status: 422 });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
    await this.audit.log({ organizationId: auth.organizationId, actorType: 'USER', actorId: user.id, action: 'auth.mfa_enabled' });
  }

  async disableTotp(auth: AuthContext, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!user.totpEnabledAt || !user.totpSecretEnc || !verifyTotp(decryptSecret(user.totpSecretEnc).toString(), code)) {
      throw new AppError('mfa_invalid', 'Der Code ist nicht korrekt.', { status: 422 });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: null, totpSecretEnc: null } });
    await this.audit.log({ organizationId: auth.organizationId, actorType: 'USER', actorId: user.id, action: 'auth.mfa_disabled' });
  }

  // ── Einladungen ───────────────────────────────────────────────────────
  private async loadInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { organization: { select: { name: true } } } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
      throw new AppError('token_invalid', 'Diese Einladung ist ungültig oder abgelaufen.');
    }
    return invitation;
  }

  async invitationInfo(token: string) {
    const invitation = await this.loadInvitation(token);
    const user = await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    return { organizationName: invitation.organization.name, email: invitation.email, role: invitation.role, userExists: Boolean(user) };
  }

  async acceptInvitation(input: z.infer<typeof acceptInvitationSchema>, meta: RequestMeta, res: Response): Promise<{ needsLogin: boolean }> {
    const invitation = await this.loadInvitation(input.token);
    let user = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    const isNew = !user;
    if (!user) {
      if (!input.name || !input.password) {
        throw new AppError('validation_failed', 'Bitte gib Name und Passwort an.', { fields: { name: 'Erforderlich', password: 'Erforderlich' } });
      }
      user = await this.prisma.user.create({
        data: { email: invitation.email, name: input.name, passwordHash: await this.hashPassword(input.password), emailVerifiedAt: new Date() },
      });
    }
    await this.prisma.$transaction([
      this.prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
        create: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
        update: {},
      }),
      this.prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    await this.audit.log({ organizationId: invitation.organizationId, actorType: 'USER', actorId: user.id, action: 'member.joined', metadata: { role: invitation.role }, ...meta });
    if (isNew) {
      await this.sessions.create(res, { userId: user.id, organizationId: invitation.organizationId, mfaPending: false, ...meta });
      return { needsLogin: false };
    }
    return { needsLogin: true };
  }
}
