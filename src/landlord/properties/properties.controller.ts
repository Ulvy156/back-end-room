import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { LandlordPropertiesService } from './properties.service';
import { FindLandlordPropertiesDto } from './dto/find-landlord-properties.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Roles(UserRole.LANDLORD, UserRole.ADMIN)
@Controller('landlord/properties')
export class LandlordPropertiesController {
  constructor(private readonly propertiesService: LandlordPropertiesService) {}

  @Get()
  getProperties(
    @Req() req: AuthenticatedRequest,
    @Query() filter: FindLandlordPropertiesDto,
    @Query('landlordId') landlordId?: string,
  ) {
    const targetId =
      req.user.role === UserRole.ADMIN && landlordId ? landlordId : req.user.id;
    return this.propertiesService.getProperties(targetId, filter);
  }

  @Get(':id')
  getPropertyDetail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertiesService.getPropertyDetail(
      id,
      req.user.id,
      req.user.role,
    );
  }
}
