import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PropertyImageModule } from './property-image/property-image.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { UserModule } from './user/user.module';
import { AmenityModule } from './amenity/amenity.module';
import { PropertyTypeModule } from './property-type/property-type.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    PropertyImageModule,
    AuthModule,
    UserModule,
    AmenityModule,
    PropertyTypeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
