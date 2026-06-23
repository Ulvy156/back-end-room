import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from 'prisma/generated/enums';
import { Roles } from 'src/auth/roles.decorator';
import { PropertyReportService } from './property-report.service';
import { CreatePropertyReportDto } from './dto/create-property-report.dto';
import { FindPropertyReportsDto } from './dto/find-property-reports.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('property-report')
export class PropertyReportController {
  constructor(private readonly reportService: PropertyReportService) {}

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post(':propertyId')
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePropertyReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportService.create(req.user.id, propertyId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() dto: FindPropertyReportsDto) {
    return this.reportService.findAll(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportService.remove(id, req.user.id, req.user.role);
  }
}
