import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { assignableRoles, type inviteMemberSchema, type locationSchema, type Role, type updateOrganizationSchema } from '@tably/types';
import { ENV, type Env } from '../../common/env';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { EntitlementsService } from '../../common/entitlements.service';
import { MailService } from '../../common/mail.service';
import { AppError, forbidden, notFound } from '../../common/errors';
import { hashToken, randomToken, sha256Hex } from '../../common/crypto';
import { addDays, isValidTimeZone } from '../../common/util';
import type { TenantContext } from '../../common/auth.types';

const MAX_LOGO_BYTES = 512 * 1024;

function detectImage(data: Buffer): 'image/png' | 'image/jpeg' | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get(ctx: TenantContext) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  }

  async update(ctx: TenantContext, input: z.infer<typeof updateOrganizationSchema>) {
    if (input.timezone && !isValidTimeZone(input.timezone)) {
      throw new AppError('validation_failed', 'Unbekannte Zeitzone.', { fields: { timezone: 'Unbekannte Zeitzone' } });
    }
    const org = await this.prisma.organization.update({ where: { id: ctx.organizationId }, data: input });
    await this.audit.byUser(ctx, 'organization.updated', { type: 'Organization', id: org.id }, { fields: Object.keys(input) });
    return org;
  }

  async setLogo(ctx: TenantContext, dataBase64: string) {
    const data = Buffer.from(dataBase64, 'base64');
    if (data.length === 0 || data.length > MAX_LOGO_BYTES) {
      throw new AppError('validation_failed', 'Das Logo darf höchstens 512 KB groß sein.', { fields: { logo: 'Datei zu groß' } });
    }
    const mimeType = detectImage(data);
    if (!mimeType) throw new AppError('validation_failed', 'Bitte lade ein PNG- oder JPEG-Bild hoch.', { fields: { logo: 'Nur PNG oder JPEG' } });
    const previous = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { logoAssetId: true } });
    const asset = await this.prisma.asset.create({
      data: { organizationId: ctx.organizationId, kind: 'logo', mimeType, sizeBytes: data.length, sha256: sha256Hex(data), data },
      select: { id: true, mimeType: true, sizeBytes: true },
    });
    await this.prisma.organization.update({ where: { id: ctx.organizationId }, data: { logoAssetId: asset.id } });
    if (previous.logoAssetId) await this.prisma.asset.deleteMany({ where: { id: previous.logoAssetId, organizationId: ctx.organizationId } });
    await this.audit.byUser(ctx, 'organization.logo_updated', { type: 'Asset', id: asset.id });
    return asset;
  }

  async removeLogo(ctx: TenantContext): Promise<void> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { logoAssetId: true } });
    if (!org.logoAssetId) return;
    await this.prisma.organization.update({ where: { id: ctx.organizationId }, data: { logoAssetId: null } });
    await this.prisma.asset.deleteMany({ where: { id: org.logoAssetId, organizationId: ctx.organizationId } });
  }

  // ── Standorte ─────────────────────────────────────────────────────────
  listLocations(ctx: TenantContext) {
    return this.prisma.location.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { devices: true } } },
    });
  }

  async createLocation(ctx: TenantContext, input: z.infer<typeof locationSchema>) {
    await this.entitlements.assertLimit(ctx.organizationId, 'locations', 'Standorte');
    const location = await this.prisma.location.create({ data: { ...input, organizationId: ctx.organizationId } });
    await this.audit.byUser(ctx, 'location.created', { type: 'Location', id: location.id });
    return location;
  }

  async updateLocation(ctx: TenantContext, id: string, input: Partial<z.infer<typeof locationSchema>>) {
    const existing = await this.prisma.location.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!existing) throw notFound('Standort');
    if (input.isActive === true && !existing.isActive) await this.entitlements.assertLimit(ctx.organizationId, 'locations', 'Standorte');
    if (input.isActive === false && existing.isActive) {
      const active = await this.prisma.location.count({ where: { organizationId: ctx.organizationId, isActive: true } });
      if (active <= 1) throw new AppError('conflict', 'Mindestens ein Standort muss aktiv bleiben.');
    }
    const location = await this.prisma.location.update({ where: { id }, data: input });
    await this.audit.byUser(ctx, 'location.updated', { type: 'Location', id });
    return location;
  }

  // ── Team ──────────────────────────────────────────────────────────────
  async listMembers(ctx: TenantContext) {
    const [members, invitations] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: { organizationId: ctx.organizationId },
        include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true, totpEnabledAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { organizationId: ctx.organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        name: m.user.name,
        email: m.user.email,
        lastLoginAt: m.user.lastLoginAt,
        totpEnabled: Boolean(m.user.totpEnabledAt),
        joinedAt: m.createdAt,
      })),
      invitations,
    };
  }

  async invite(ctx: TenantContext, input: z.infer<typeof inviteMemberSchema>) {
    if (!assignableRoles(ctx.role).includes(input.role)) throw forbidden('Diese Rolle darfst du nicht vergeben.');
    await this.entitlements.assertLimit(ctx.organizationId, 'staff', 'Teammitglieder');
    const existingMember = await this.prisma.organizationMember.findFirst({ where: { organizationId: ctx.organizationId, user: { email: input.email } } });
    if (existingMember) throw new AppError('conflict', 'Diese Person gehört bereits zum Team.', { fields: { email: 'Bereits im Team' } });
    await this.prisma.invitation.updateMany({
      where: { organizationId: ctx.organizationId, email: input.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const token = randomToken();
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { name: true } });
    const invitation = await this.prisma.invitation.create({
      data: { organizationId: ctx.organizationId, email: input.email, role: input.role, tokenHash: hashToken(token), invitedById: ctx.userId, expiresAt: addDays(new Date(), 7) },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    await this.mail.send({
      to: input.email,
      kind: 'team.invitation',
      organizationId: ctx.organizationId,
      subject: `Einladung zu ${org.name} auf Tably`,
      text: `Hallo,\n\ndu wurdest eingeladen, bei „${org.name}“ auf Tably mitzuarbeiten.\n\nEinladung annehmen:\n${this.env.DASHBOARD_URL}/invite?token=${token}\n\nDer Link ist 7 Tage gültig.`,
    });
    await this.audit.byUser(ctx, 'member.invited', { type: 'Invitation', id: invitation.id }, { email: input.email, role: input.role });
    return invitation;
  }

  async revokeInvitation(ctx: TenantContext, id: string): Promise<void> {
    const result = await this.prisma.invitation.updateMany({ where: { id, organizationId: ctx.organizationId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (result.count === 0) throw notFound('Einladung');
    await this.audit.byUser(ctx, 'member.invitation_revoked', { type: 'Invitation', id });
  }

  private async loadMember(ctx: TenantContext, memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId: ctx.organizationId } });
    if (!member) throw notFound('Teammitglied');
    if (member.role === 'OWNER') throw forbidden('Die Inhaberrolle kann nicht geändert werden.');
    if (member.userId === ctx.userId) throw forbidden('Du kannst deine eigene Rolle nicht ändern.');
    if (!assignableRoles(ctx.role).includes(member.role as Role)) throw forbidden();
    return member;
  }

  async updateMemberRole(ctx: TenantContext, memberId: string, role: Role) {
    const member = await this.loadMember(ctx, memberId);
    if (!assignableRoles(ctx.role).includes(role)) throw forbidden('Diese Rolle darfst du nicht vergeben.');
    const updated = await this.prisma.organizationMember.update({ where: { id: member.id }, data: { role } });
    await this.audit.byUser(ctx, 'member.role_changed', { type: 'OrganizationMember', id: member.id }, { from: member.role, to: role });
    return updated;
  }

  async removeMember(ctx: TenantContext, memberId: string): Promise<void> {
    const member = await this.loadMember(ctx, memberId);
    await this.prisma.$transaction([
      this.prisma.organizationMember.delete({ where: { id: member.id } }),
      // Laufende Sitzungen der Person verlieren sofort den Zugriff auf diese Organisation
      this.prisma.session.updateMany({ where: { userId: member.userId, organizationId: ctx.organizationId }, data: { organizationId: null } }),
    ]);
    await this.audit.byUser(ctx, 'member.removed', { type: 'OrganizationMember', id: member.id }, { userId: member.userId });
  }

  // ── API-Schlüssel ─────────────────────────────────────────────────────
  listApiKeys(ctx: TenantContext) {
    return this.prisma.apiKey.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    });
  }

  async createApiKey(ctx: TenantContext, name: string) {
    await this.entitlements.assertFeature(ctx.organizationId, 'posApi', 'Die Kassen-Schnittstelle');
    const key = `tably_${randomToken(30)}`;
    const record = await this.prisma.apiKey.create({
      data: { organizationId: ctx.organizationId, name, prefix: key.slice(0, 12), keyHash: hashToken(key), scopes: ['pos:write'], createdById: ctx.userId },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true },
    });
    await this.audit.byUser(ctx, 'apikey.created', { type: 'ApiKey', id: record.id });
    // Der Schlüssel wird nur dieses eine Mal im Klartext zurückgegeben.
    return { ...record, key };
  }

  async revokeApiKey(ctx: TenantContext, id: string): Promise<void> {
    const result = await this.prisma.apiKey.updateMany({ where: { id, organizationId: ctx.organizationId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (result.count === 0) throw notFound('API-Schlüssel');
    await this.audit.byUser(ctx, 'apikey.revoked', { type: 'ApiKey', id });
  }

  // ── Onboarding ────────────────────────────────────────────────────────
  async onboarding(ctx: TenantContext) {
    const organizationId = ctx.organizationId;
    const [org, program, publishedProgram, reward, device, activeDevice, firstStamp] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      this.prisma.loyaltyProgram.findFirst({ where: { organizationId, status: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
      this.prisma.loyaltyProgram.findFirst({ where: { organizationId, status: 'PUBLISHED' }, select: { id: true } }),
      this.prisma.reward.findFirst({ where: { organizationId, isActive: true }, select: { id: true } }),
      this.prisma.nfcDevice.findFirst({ where: { organizationId, status: { not: 'RETIRED' } }, select: { id: true } }),
      this.prisma.nfcDevice.findFirst({ where: { organizationId, status: 'ACTIVE' }, select: { id: true } }),
      this.prisma.stampTransaction.findFirst({ where: { organizationId, type: 'EARN', source: { in: ['NFC_TAP', 'SIMULATED_TAP'] } }, select: { id: true } }),
    ]);
    const steps = [
      { key: 'company', done: org.industry !== 'other' || Boolean(org.city) },
      { key: 'program', done: Boolean(program) },
      { key: 'reward', done: Boolean(reward) },
      { key: 'publish', done: Boolean(publishedProgram) },
      { key: 'device', done: Boolean(device) },
      { key: 'test', done: Boolean(firstStamp) || (Boolean(activeDevice) && Boolean(firstStamp)) },
    ];
    return { steps, completed: Boolean(org.onboardingCompletedAt), programId: program?.id ?? null, allDone: steps.every((s) => s.done) };
  }

  async completeOnboarding(ctx: TenantContext): Promise<void> {
    await this.prisma.organization.update({ where: { id: ctx.organizationId }, data: { onboardingCompletedAt: new Date() } });
  }

  async auditLog(ctx: TenantContext, page: number, pageSize: number) {
    const where = { organizationId: ctx.organizationId };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    const userIds = [...new Set(items.filter((i) => i.actorType === 'USER' && i.actorId).map((i) => i.actorId!))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return { items: items.map((i) => ({ ...i, actorName: i.actorId ? (names.get(i.actorId) ?? null) : null })), total, page, pageSize };
  }
}
