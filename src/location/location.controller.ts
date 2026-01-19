import { Controller, Get, Query } from '@nestjs/common';
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
}
