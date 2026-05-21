import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PropertyImageModule } from './property-image/property-image.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { UserModule } from './user/user.module';
import { AmenityModule } from './amenity/amenity.module';
import { PropertyTypeModule } from './property-type/property-type.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PropertyModule } from './property/property.module';
import { AppCacheModule } from './cache/cache.module';
import { LocationModule } from './location/location.module';
import { PropertyAmenityModule } from './property-amenity/property-amenity.module';
import { PropertyRulesModule } from './property-rules/property-rules.module';
import { UserFavouriteModule } from './user-favourite/user-favourite.module';
import { RolesGuard } from './auth/roles.guard';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? // Dev: readable pretty output in terminal
              {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:HH:MM:ss',
                  ignore: 'pid,hostname',
                },
              }
            : // Prod: JSON to stdout + JSON to log file
              {
                targets: [
                  {
                    target: 'pino/file',
                    options: { destination: 1 },
                    level: 'info',
                  },
                  {
                    target: 'pino/file',
                    options: { destination: './logs/app.log', mkdir: true },
                    level: 'info',
                  },
                ],
              },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 30,
        },
      ],
    }),
    AppCacheModule,
    AppConfigModule,
    PrismaModule,
    QueueModule,
    PropertyImageModule,
    AuthModule,
    UserModule,
    AmenityModule,
    PropertyTypeModule,
    PropertyModule,
    LocationModule,
    PropertyAmenityModule,
    PropertyRulesModule,
    UserFavouriteModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
