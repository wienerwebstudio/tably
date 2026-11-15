import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json } from 'express';
import { AllExceptionsFilter } from './common/errors';
import { PrismaService } from './common/prisma.service';
import { csrfMiddleware } from './common/csrf';
import { getEnv } from './common/env';

/** Gemeinsame Konfiguration für Produktion und Integrationstests. */
export function configureApp(app: NestExpressApplication): void {
  const env = getEnv();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Logo-Uploads kommen als Base64 im JSON (max. 512 KB Bild)
  app.use(json({ limit: '1mb', verify: (req, _res, buf) => ((req as unknown as { rawBody: Buffer }).rawBody = buf) }));
  app.enableCors({
    origin: [new URL(env.WEB_URL).origin, new URL(env.DASHBOARD_URL).origin],
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Tapperl-Request', 'Idempotency-Key'],
  });
  app.use(csrfMiddleware(env));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(PrismaService)));
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Tapperl API')
    .setDescription(
      'REST-API der Tapperl-Plattform. Dashboard-Routen verwenden Cookie-Sitzungen (schreibende Anfragen brauchen den Header `X-Tapperl-Request: 1`). ' +
        'Die Kassen-Schnittstelle unter /integrations verwendet API-Schlüssel (`Authorization: Bearer tapperl_…`).',
    )
    .setVersion('0.1.0')
    .addCookieAuth('tapperl_session')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'API-Schlüssel der Organisation' }, 'apiKey')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'docs/openapi.json' });
}
