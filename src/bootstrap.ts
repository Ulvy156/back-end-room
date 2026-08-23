import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { corsConfig } from './config/cors.config';
import { Logger } from 'nestjs-pino';
import { QueueService } from './queue/queue.service';
import { registerProcessCrashHandlers } from './common/process-crash-handlers';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable built-in logger — Pino takes over via app.useLogger below.
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  registerProcessCrashHandlers(logger, app.get(QueueService));
  // Trust Caddy (1 hop) so req.ip reflects the real client IP from X-Forwarded-For
  // instead of Caddy's own address — required for per-IP rate limiting to work.
  app.set('trust proxy', 1);
  app.use(helmet());
  // parse cookies
  app.use(cookieParser());

  // Global JWT guard
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // enable validate
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  //enable cors
  app.enableCors(corsConfig);

  return app;
}
