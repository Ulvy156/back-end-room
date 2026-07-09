import { Module } from '@nestjs/common';
import { LandlordDashboardController } from './dashboard/dashboard.controller';
import { LandlordDashboardService } from './dashboard/dashboard.service';
import { LandlordPropertiesController } from './properties/properties.controller';
import { LandlordPropertiesService } from './properties/properties.service';
import { LandlordProfileController } from './profile/profile.controller';
import { LandlordProfileService } from './profile/profile.service';

@Module({
  controllers: [
    LandlordDashboardController,
    LandlordPropertiesController,
    LandlordProfileController,
  ],
  providers: [
    LandlordDashboardService,
    LandlordPropertiesService,
    LandlordProfileService,
  ],
})
export class LandlordModule {}
