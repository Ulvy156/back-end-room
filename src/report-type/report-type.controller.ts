import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/auth/public.decorator';
import { ReportTypeService } from './report-type.service';

@Controller('report-type')
export class ReportTypeController {
  constructor(private readonly reportTypeService: ReportTypeService) {}

  @Public()
  @Get()
  findAll() {
    return this.reportTypeService.findAll();
  }
}
