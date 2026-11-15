import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaService, type Tx } from './prisma.service';
import type { TenantContext } from './auth.types';

export interface AuditEntry {
  organizationId?: string | null;
  actorType: 'USER' | 'CUSTOMER' | 'DEVICE' | 'SYSTEM' | 'API_KEY' | 'SUPER_ADMIN';
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  /** Schreibt einen Audit-Eintrag. Fehler beim Protokollieren brechen den Vorgang nicht ab. */
  async log(entry: AuditEntry, tx?: Tx): Promise<void> {
    try {
      await (tx ?? this.prisma).auditLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Audit-Eintrag ${entry.action} fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  byUser(ctx: TenantContext, action: string, target?: { type: string; id: string }, metadata?: Record<string, unknown>, tx?: Tx): Promise<void> {
    return this.log(
      { organizationId: ctx.organizationId, actorType: 'USER', actorId: ctx.userId, action, targetType: target?.type, targetId: target?.id, metadata, ip: ctx.ip, userAgent: ctx.userAgent },
      tx,
    );
  }
}
