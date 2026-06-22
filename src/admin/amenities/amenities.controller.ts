import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { AmenityService } from 'src/amenity/amenity.service';
import { CreateAmenityDto } from 'src/amenity/dto/create-amenity.dto';
import { UpdateAmenityDto } from 'src/amenity/dto/update-amenity.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/amenities')
export class AdminAmenitiesController {
  constructor(private readonly amenityService: AmenityService) {}

  @Get()
  findAll() {
    return this.amenityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.amenityService.findOne(+id);
  }

  @Post()
  create(@Body() dto: CreateAmenityDto) {
    return this.amenityService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAmenityDto) {
    return this.amenityService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.amenityService.remove(+id);
  }
}
