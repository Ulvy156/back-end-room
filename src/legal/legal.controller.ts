import { Controller, Get, Param } from '@nestjs/common';
import { Public } from 'src/auth/public.decorator';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Public()
  @Get(':slug')
  getDocument(@Param('slug') slug: string) {
    return this.legalService.getDocument(slug);
  }
}
