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
import { PropertyTypeService } from 'src/property-type/property-type.service';
import { CreatePropertyTypeDto } from 'src/property-type/dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from 'src/property-type/dto/update-property-type.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/property-types')
export class AdminPropertyTypesController {
  constructor(private readonly propertyTypeService: PropertyTypeService) {}

  @Get()
  findAll() {
    return this.propertyTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyTypeService.findOne(+id);
  }

  @Post()
  create(@Body() dto: CreatePropertyTypeDto) {
    return this.propertyTypeService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropertyTypeDto) {
    return this.propertyTypeService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyTypeService.remove(+id);
  }
}
