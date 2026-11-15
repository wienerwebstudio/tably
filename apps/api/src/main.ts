import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { getEnv } from './common/env';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  await app.listen(env.API_PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`Tably API läuft auf Port ${env.API_PORT} · Queue: ${env.QUEUE_DRIVER} · Doku: /docs`);
}

void bootstrap();
