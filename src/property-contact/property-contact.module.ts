import { Module } from '@nestjs/common';
import { PropertyContactController } from './property-contact.controller';
import { PropertyContactService } from './property-contact.service';

@Module({
  controllers: [PropertyContactController],
  providers: [PropertyContactService],
})
export class PropertyContactModule {}
