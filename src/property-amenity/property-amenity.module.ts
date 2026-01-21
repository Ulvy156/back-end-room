import { Module } from '@nestjs/common';
import { PropertyAmenityService } from './property-amenity.service';
import { PropertyAmenityController } from './property-amenity.controller';

@Module({
  controllers: [PropertyAmenityController],
  providers: [PropertyAmenityService],
})
export class PropertyAmenityModule {}
