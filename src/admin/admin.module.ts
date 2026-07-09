import { Module } from '@nestjs/common';
import { PropertyTypeModule } from 'src/property-type/property-type.module';
import { AmenityModule } from 'src/amenity/amenity.module';
import { PropertyRulesModule } from 'src/property-rules/property-rules.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AdminPropertiesController } from './properties/properties.controller';
import { AdminPropertiesService } from './properties/properties.service';
import { AdminLandlordsController } from './landlords/landlords.controller';
import { AdminLandlordsService } from './landlords/landlords.service';
import { AdminPropertyTypesController } from './property-types/property-types.controller';
import { AdminAmenitiesController } from './amenities/amenities.controller';
import { AdminHouseRulesController } from './house-rules/house-rules.controller';
import { FeedbackModule } from 'src/feedback/feedback.module';
import { AdminFeedbackController } from './feedback/feedback.controller';
import { AdminSettingsController } from './settings/settings.controller';
import { LegalModule } from 'src/legal/legal.module';
import { AdminLegalController } from './legal/legal.controller';

@Module({
  imports: [
    PropertyTypeModule,
    AmenityModule,
    PropertyRulesModule,
    FeedbackModule,
    LegalModule,
  ],
  controllers: [
    DashboardController,
    AdminPropertiesController,
    AdminLandlordsController,
    AdminPropertyTypesController,
    AdminAmenitiesController,
    AdminHouseRulesController,
    AdminFeedbackController,
    AdminSettingsController,
    AdminLegalController,
  ],
  providers: [DashboardService, AdminPropertiesService, AdminLandlordsService],
})
export class AdminModule {}
