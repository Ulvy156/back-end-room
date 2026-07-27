import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocationService } from './location.service';
import { Public } from 'src/auth/public.decorator';

@Public()
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  getLocationSuggestions(@Query('q') q: string) {
    return this.locationService.getLocationSuggestions(q);
  }

  @Get('/province')
  getAllProvinces() {
    return this.locationService.getAllProvinces();
  }

  @Get('/province/:id')
  getProvinceById(@Param('id') id: number) {
    return this.locationService.getProvinceById(id);
  }

  @Get('/province/:id/coordinates')
  getProvinceCoordinates(@Param('id') id: number) {
    return this.locationService.getProvinceCoordinates(id);
  }

  @Get('/district/:id')
  getDistrictById(@Param('id') id: number) {
    return this.locationService.getDistrictById(id);
  }

  @Get('/district/province/:id')
  getDistrictByProvinceId(@Param('id') id: number) {
    return this.locationService.getDistrictByProvinceId(id);
  }
}
