import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SkipAudit } from '../audit-log/skip-audit.decorator';
import { Public } from '../auth/public.decorator';
import { CreatePropertyContactDto } from './dto/create-property-contact.dto';
import { PropertyContactService } from './property-contact.service';

@Controller('properties')
export class PropertyContactController {
  constructor(
    private readonly propertyContactService: PropertyContactService,
  ) {}

  @SkipAudit()
  @Public()
  @Throttle({ default: { limit: 40, ttl: 60000 } }) // 40 per min — prevents count manipulation
  @Post(':propertyId/contact')
  @HttpCode(HttpStatus.ACCEPTED)
  async recordContactClick(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePropertyContactDto,
  ) {
    await this.propertyContactService.recordClick(propertyId, dto);
  }
}
