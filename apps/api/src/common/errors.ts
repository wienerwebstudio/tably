import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody, ErrorCode } from '@tably/types';
import { ThrottlerException } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';

const STATUS: Partial<Record<ErrorCode, number>> = {
  validation_failed: 400,
  unauthenticated: 401,
  invalid_credentials: 401,
  mfa_required: 401,
  mfa_invalid: 401,
  forbidden: 403,
  csrf_failed: 403,
  email_not_verified: 403,
  subscription_restricted: 402,
  organization_suspended: 403,
  feature_not_in_plan: 402,
  limit_reached: 402,
  not_found: 404,
  conflict: 409,
  email_taken: 409,
  account_locked: 423,
  rate_limited: 429,
  integration_not_configured: 503,
  simulator_disabled: 403,
  internal_error: 500,
};

/** Fachlicher Fehler mit stabilem Code. Alle anderen Codes werden als 422 gemeldet. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly extra: { details?: Record<string, unknown>; fields?: Record<string, string>; status?: number } = {},
  ) {
    super(message);
    this.status = extra.status ?? STATUS[code] ?? 422;
  }
}

export const notFound = (what = 'Eintrag') => new AppError('not_found', `${what} nicht gefunden.`);
export const forbidden = (message = 'Dafür fehlt dir die Berechtigung.') => new AppError('forbidden', message);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');
  constructor(private readonly prisma: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    let status = 500;
    let body: ApiErrorBody;

    if (exception instanceof AppError) {
      status = exception.status;
      body = { error: { code: exception.code, message: exception.message, details: exception.extra.details, fields: exception.extra.fields } };
    } else if (exception instanceof ThrottlerException) {
      status = 429;
      body = { error: { code: 'rate_limited', message: 'Zu viele Anfragen. Bitte warte einen Moment.' } };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const code: ErrorCode =
        status === 404 ? 'not_found' : status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : status === 413 ? 'validation_failed' : status >= 500 ? 'internal_error' : 'validation_failed';
      body = { error: { code, message: status === 404 ? 'Nicht gefunden.' : exception.message } };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = { error: { code: 'internal_error', message: 'Unerwarteter Fehler. Wir wurden informiert.' } };
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${req.method} ${req.path}: ${err.message}`, err.stack);
      // Technisches Fehlerprotokoll für das Super-Admin-Panel (ohne personenbezogene Nutzdaten)
      void this.prisma.systemError
        .create({ data: { source: 'api', message: err.message.slice(0, 1000), stack: err.stack?.slice(0, 4000), context: { method: req.method, path: req.path } } })
        .catch(() => undefined);
    }
    if (res.headersSent) return;
    res.status(status).json(body);
  }
}
