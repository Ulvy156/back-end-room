import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Roles(UserRole.ADMIN)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@Query() dto: QueryAuditLogDto) {
    return this.auditLogService.findAll(dto);
  }
}
