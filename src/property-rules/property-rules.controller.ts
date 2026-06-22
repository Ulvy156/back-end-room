import { Controller, Get } from '@nestjs/common';
import { PropertyRulesService } from './property-rules.service';
import { Public } from 'src/auth/public.decorator';

@Controller('property-rules')
export class PropertyRulesController {
  constructor(private readonly propertyRulesService: PropertyRulesService) {}

  @Public()
  @Get()
  findAll() {
    return this.propertyRulesService.findAll();
  }
}
