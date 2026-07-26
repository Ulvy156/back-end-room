import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { AdminLandlordsService } from './landlords.service';

@Roles(UserRole.ADMIN)
@Controller('admin/landlords')
export class AdminLandlordsController {
  constructor(private readonly adminLandlordsService: AdminLandlordsService) {}

  @Get(':id/properties')
  getLandlordProperties(@Param('id') id: string) {
    return this.adminLandlordsService.getLandlordProperties(id);
  }
}
