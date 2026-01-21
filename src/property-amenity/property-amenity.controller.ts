import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PropertyAmenityService } from './property-amenity.service';
import { CreatePropertyAmenityDto } from './dto/create-property-amenity.dto';
import { UpdatePropertyAmenityDto } from './dto/update-property-amenity.dto';
import { Public } from 'src/auth/public.decorator';

@Controller('property-amenity')
export class PropertyAmenityController {
  constructor(
    private readonly propertyAmenityService: PropertyAmenityService,
  ) {}

  @Post()
  create(@Body() createPropertyAmenityDto: CreatePropertyAmenityDto) {
    return this.propertyAmenityService.create(createPropertyAmenityDto);
  }

  @Public()
  @Get()
  async findAll() {
    return await this.propertyAmenityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyAmenityService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyAmenityDto: UpdatePropertyAmenityDto,
  ) {
    return this.propertyAmenityService.update(+id, updatePropertyAmenityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyAmenityService.remove(+id);
  }
}
