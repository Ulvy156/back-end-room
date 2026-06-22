import { Controller, Get, Param } from '@nestjs/common';
import { PropertyTypeService } from './property-type.service';
import { Public } from 'src/auth/public.decorator';

@Controller('property-type')
export class PropertyTypeController {
  constructor(private readonly propertyTypeService: PropertyTypeService) {}

  @Public()
  @Get()
  findAll() {
    return this.propertyTypeService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyTypeService.findOne(+id);
  }
}
