import * as path from 'path';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { TranslationModule } from './i18n/translation.module';
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
import { PropertyDraftModule } from './property-draft/property-draft.module';
import { AppCacheModule } from './cache/cache.module';
import { LocationModule } from './location/location.module';
import { PropertyAmenityModule } from './property-amenity/property-amenity.module';
import { PropertyRulesModule } from './property-rules/property-rules.module';
import { UserFavouriteModule } from './user-favourite/user-favourite.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { QueueModule } from './queue/queue.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AdminModule } from './admin/admin.module';
import { LandlordModule } from './landlord/landlord.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditInterceptor } from './audit-log/audit.interceptor';
import { PropertyReportModule } from './property-report/property-report.module';
import { ReportTypeModule } from './report-type/report-type.module';
import { SettingsModule } from './settings/settings.module';
import { MaintenanceGuard } from './settings/maintenance.guard';
import { LegalModule } from './legal/legal.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

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
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '../i18n/'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [AcceptLanguageResolver],
    }),
    TranslationModule,
    AppCacheModule,
    AppConfigModule,
    SettingsModule,
    PrismaModule,
    QueueModule,
    PropertyImageModule,
    AuthModule,
    UserModule,
    AmenityModule,
    PropertyTypeModule,
    PropertyModule,
    PropertyDraftModule,
    LocationModule,
    PropertyAmenityModule,
    PropertyRulesModule,
    UserFavouriteModule,
    FeedbackModule,
    AdminModule,
    LandlordModule,
    AuditLogModule,
    PropertyReportModule,
    ReportTypeModule,
    LegalModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
