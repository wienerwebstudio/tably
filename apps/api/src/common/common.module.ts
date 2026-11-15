import { Global, Module } from '@nestjs/common';
import { ENV, getEnv } from './env';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { SessionService } from './session.service';
import { EntitlementsService } from './entitlements.service';
import { MailService } from './mail.service';
import { QueueService } from './queue.service';
import { ApiKeyGuard, PermissionGuard, SessionGuard, SuperAdminGuard } from './guards';

const providers = [
  { provide: ENV, useFactory: getEnv },
  PrismaService,
  AuditService,
  SessionService,
  EntitlementsService,
  MailService,
  QueueService,
  SessionGuard,
  PermissionGuard,
  SuperAdminGuard,
  ApiKeyGuard,
];

@Global()
@Module({ providers, exports: providers })
export class CommonModule {}
