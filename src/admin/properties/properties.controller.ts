import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { AdminPropertiesService } from './properties.service';
import { FindAdminPropertiesDto } from './dto/find-admin-properties.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/properties')
export class AdminPropertiesController {
  constructor(
    private readonly adminPropertiesService: AdminPropertiesService,
  ) {}

  @Get()
  getAllProperties(@Query() filter: FindAdminPropertiesDto) {
    return this.adminPropertiesService.getAllProperties(filter);
  }

  @Get(':id')
  getPropertyDetail(@Param('id') id: string) {
    return this.adminPropertiesService.getPropertyDetail(id);
  }
}
