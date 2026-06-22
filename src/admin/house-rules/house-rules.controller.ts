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
import { PropertyRulesService } from 'src/property-rules/property-rules.service';
import { CreatePropertyRuleDto } from 'src/property-rules/dto/create-property-rule.dto';
import { UpdatePropertyRuleDto } from 'src/property-rules/dto/update-property-rule.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/house-rules')
export class AdminHouseRulesController {
  constructor(private readonly propertyRulesService: PropertyRulesService) {}

  @Get()
  findAll() {
    return this.propertyRulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyRulesService.findOne(+id);
  }

  @Post()
  create(@Body() dto: CreatePropertyRuleDto) {
    return this.propertyRulesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropertyRuleDto) {
    return this.propertyRulesService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyRulesService.remove(+id);
  }
}
