import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PropertyImageModule } from './property-image/property-image.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [AppConfigModule, PrismaModule, PropertyImageModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
