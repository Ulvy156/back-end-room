import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PropertyRulesService } from './property-rules.service';
import { CreatePropertyRuleDto } from './dto/create-property-rule.dto';
import { UpdatePropertyRuleDto } from './dto/update-property-rule.dto';
import { Public } from 'src/auth/public.decorator';

@Controller('property-rules')
export class PropertyRulesController {
  constructor(private readonly propertyRulesService: PropertyRulesService) {}

  @Post()
  create(@Body() createPropertyRuleDto: CreatePropertyRuleDto) {
    return this.propertyRulesService.create(createPropertyRuleDto);
  }

  @Public()
  @Get()
  findAll() {
    return this.propertyRulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyRulesService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyRuleDto: UpdatePropertyRuleDto,
  ) {
    return this.propertyRulesService.update(+id, updatePropertyRuleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyRulesService.remove(+id);
  }
}
