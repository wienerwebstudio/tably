import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { QueueService } from './queue.service';

const DAY = 86_400_000;

/** Tägliche Aufräumarbeiten: abgelaufene Sitzungen, Tokens und offene Taps. */
@Injectable()
export class MaintenanceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    this.queue.registerRecurring('maintenance.tick', DAY, () => this.run().then(() => undefined));
  }

  async run(now: Date = new Date()) {
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const [sessions, authTokens, loginTokens, customerSessions, invitations, taps, redemptions, cards] = await Promise.all([
      this.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: weekAgo } }, { revokedAt: { lt: weekAgo } }] } }),
      this.prisma.authToken.deleteMany({ where: { expiresAt: { lt: weekAgo } } }),
      this.prisma.customerLoginToken.deleteMany({ where: { expiresAt: { lt: weekAgo } } }),
      this.prisma.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.invitation.deleteMany({ where: { expiresAt: { lt: weekAgo }, acceptedAt: null } }),
      this.prisma.tapEvent.updateMany({ where: { status: { in: ['VERIFIED', 'PENDING_APPROVAL', 'PENDING_POS'] }, expiresAt: { lt: now } }, data: { status: 'EXPIRED' } }),
      this.prisma.rewardRedemption.updateMany({ where: { status: 'PENDING', codeExpiresAt: { lt: now } }, data: { status: 'EXPIRED', codeHash: null } }),
      this.prisma.loyaltyCard.updateMany({ where: { status: 'ACTIVE', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } }),
    ]);
    return { sessions: sessions.count, authTokens: authTokens.count, loginTokens: loginTokens.count, customerSessions: customerSessions.count, invitations: invitations.count, taps: taps.count, redemptions: redemptions.count, cards: cards.count };
  }
}
