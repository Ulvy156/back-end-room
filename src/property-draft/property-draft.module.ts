import { Module } from '@nestjs/common';
import { PropertyDraftService } from './property-draft.service';
import { PropertyDraftController } from './property-draft.controller';
import { PropertyModule } from 'src/property/property.module';

@Module({
  imports: [PropertyModule],
  controllers: [PropertyDraftController],
  providers: [PropertyDraftService],
})
export class PropertyDraftModule {}
