import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV, type Env } from './env';
import { PrismaService } from './prisma.service';

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  organizationId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  dedupeKey?: string | null;
  /** Kennzeichnet die Art der Nachricht im Protokoll, z. B. "auth.verify" */
  kind: string;
}

export type MailResult = { status: 'SENT' | 'SENT_TEST' | 'FAILED' | 'DUPLICATE'; notificationId?: string };

/**
 * E-Mail-Versand über einen Adapter:
 *  - SMTP, wenn SMTP_URL oder SMTP_HOST (+ SMTP_PORT/SMTP_USER/SMTP_PASS) gesetzt ist
 *  - sonst lokaler Testmodus: die Nachricht wird NICHT versendet, sondern nur
 *    als Notification mit Status SENT_TEST gespeichert (Testpostfach).
 * Jede Nachricht wird protokolliert.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {
    if (env.SMTP_URL) {
      this.transporter = nodemailer.createTransport(env.SMTP_URL);
    } else if (env.SMTP_HOST) {
      const port = env.SMTP_PORT ?? 465;
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        // 465 = TLS von Anfang an, 587 = STARTTLS
        secure: port === 465,
        requireTLS: port !== 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  get mode(): 'smtp' | 'local' {
    return this.transporter ? 'smtp' : 'local';
  }

  async send(input: MailInput): Promise<MailResult> {
    let notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          organizationId: input.organizationId ?? null,
          customerId: input.customerId ?? null,
          campaignId: input.campaignId ?? null,
          channel: 'EMAIL',
          recipient: input.to,
          subject: input.subject,
          body: input.text,
          provider: `${this.mode}:${input.kind}`,
          dedupeKey: input.dedupeKey ?? null,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return { status: 'DUPLICATE' };
      throw err;
    }
    if (!this.transporter) {
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT_TEST', sentAt: new Date() } });
      if (this.env.NODE_ENV === 'development') this.logger.log(`[Testmodus] Mail an ${input.to}: ${input.subject}`);
      return { status: 'SENT_TEST', notificationId: notification.id };
    }
    try {
      await this.transporter.sendMail({ from: this.env.MAIL_FROM, to: input.to, subject: input.subject, text: input.text });
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT', sentAt: new Date() } });
      return { status: 'SENT', notificationId: notification.id };
    } catch (err) {
      const message = (err as Error).message.slice(0, 500);
      this.logger.error(`Versand an ${input.to} fehlgeschlagen: ${message}`);
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'FAILED', error: message } });
      return { status: 'FAILED', notificationId: notification.id };
    }
  }
}
