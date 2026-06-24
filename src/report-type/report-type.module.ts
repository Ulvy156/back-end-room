import { Module } from '@nestjs/common';
import { ReportTypeController } from './report-type.controller';
import { ReportTypeService } from './report-type.service';

@Module({
  controllers: [ReportTypeController],
  providers: [ReportTypeService],
})
export class ReportTypeModule {}
