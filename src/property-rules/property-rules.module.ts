import { Module } from '@nestjs/common';
import { PropertyRulesService } from './property-rules.service';
import { PropertyRulesController } from './property-rules.controller';

@Module({
  controllers: [PropertyRulesController],
  providers: [PropertyRulesService],
})
export class PropertyRulesModule {}
