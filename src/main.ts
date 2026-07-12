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
import { QUEUE_JOBS, SendErrorAlertJob } from './queue/queue.jobs';

// Node terminates the process on uncaughtException/unhandledRejection by default —
// alert the admin, then exit so the process manager can restart on a clean state.
function registerProcessCrashHandlers(logger: Logger, queue: QueueService) {
  const handleFatal = (label: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    logger.error(`${label}: ${message}`, stack ?? undefined);

    void queue
      .send<SendErrorAlertJob>(QUEUE_JOBS.SEND_ERROR_ALERT, {
        message: `${label}: ${message}`,
        stack,
        method: 'PROCESS',
        route: label,
        timestamp: new Date().toISOString(),
      })
      .finally(() => process.exit(1));
  };

  process.on('uncaughtException', (error) =>
    handleFatal('Uncaught Exception', error),
  );
  process.on('unhandledRejection', (reason) =>
    handleFatal('Unhandled Rejection', reason),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable built-in logger — Pino takes over via app.useLogger below.
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  registerProcessCrashHandlers(logger, app.get(QueueService));
  app.use(helmet());
  // parse cookies
  app.use(cookieParser());

  // Global JWT guard
  const reflector = app.get(Reflector);
  // Apply JWT guard globally
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
  await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();
