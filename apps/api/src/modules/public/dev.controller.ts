import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ENV, type Env } from '../../common/env';
import { PrismaService } from '../../common/prisma.service';
import { MailService } from '../../common/mail.service';
import { AppError } from '../../common/errors';

/**
 * Lokales Testpostfach. Existiert nur außerhalb der Produktion UND nur,
 * solange kein echter Mailversand konfiguriert ist: dann werden Mails nicht
 * versendet, sondern hier einsehbar protokolliert (Entwicklung, E2E-Tests).
 */
@ApiExcludeController()
@Controller('dev')
export class DevController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('mailbox')
  async mailbox(@Query('to') to?: string) {
    if (this.env.NODE_ENV === 'production' || this.mail.mode !== 'local') throw new AppError('not_found', 'Nicht gefunden.');
    return this.prisma.notification.findMany({
      where: { channel: 'EMAIL', status: 'SENT_TEST', ...(to ? { recipient: to.toLowerCase() } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, recipient: true, subject: true, body: true, provider: true, createdAt: true },
    });
  }
}
