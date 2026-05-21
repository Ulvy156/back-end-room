import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { corsConfig } from './config/cors.config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable built-in logger — Pino takes over via app.useLogger below.
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
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
