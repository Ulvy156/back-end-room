import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from 'src/auth/public.decorator';
import { LandlordProfileService } from './profile.service';
import { FindLandlordProfileDto } from './dto/find-landlord-profile.dto';

@Controller('landlord/profile')
export class LandlordProfileController {
  constructor(private readonly profileService: LandlordProfileService) {}

  @Public()
  @Get(':id')
  getProfile(
    @Param('id') id: string,
    @Query() query: FindLandlordProfileDto,
  ) {
    return this.profileService.getLandlordProfile(id, query);
  }
}
