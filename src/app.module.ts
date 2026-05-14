import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
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
