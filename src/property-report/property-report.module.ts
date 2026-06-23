import { Module } from '@nestjs/common';
import { PropertyReportController } from './property-report.controller';
import { PropertyReportService } from './property-report.service';

@Module({
  controllers: [PropertyReportController],
  providers: [PropertyReportService],
})
export class PropertyReportModule {}
