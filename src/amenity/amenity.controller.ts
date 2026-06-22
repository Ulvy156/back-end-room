import { Controller, Get, Param } from '@nestjs/common';
import { AmenityService } from './amenity.service';
import { Public } from 'src/auth/public.decorator';

@Controller('amenity')
export class AmenityController {
  constructor(private readonly amenityService: AmenityService) {}

  @Public()
  @Get()
  findAll() {
    return this.amenityService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.amenityService.findOne(+id);
  }
}
