import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { AdminService } from './admin.service';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // [ADMIN] Full dashboard data — stats, recent activity, top properties
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // [ADMIN] Get a landlord's profile and all their property listings
  @Get('landlord/:id/properties')
  getLandlordProperties(@Param('id') id: string) {
    return this.adminService.getLandlordProperties(id);
  }
}
