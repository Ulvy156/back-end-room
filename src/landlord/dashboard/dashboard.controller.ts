import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { LandlordDashboardService } from './dashboard.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Roles(UserRole.LANDLORD, UserRole.ADMIN)
@Controller('landlord/dashboard')
export class LandlordDashboardController {
  constructor(private readonly dashboardService: LandlordDashboardService) {}

  @Get()
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query('landlordId') landlordId?: string,
  ) {
    const targetId =
      req.user.role === UserRole.ADMIN && landlordId ? landlordId : req.user.id;
    return this.dashboardService.getDashboard(targetId);
  }
}
