import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/auth/public.decorator';
import { BypassMaintenance } from './bypass-maintenance.decorator';
import { SettingsService } from './settings.service';

// Bypass maintenance so the frontend can still read maintenanceMode
// (and show the maintenance banner) while the guard is blocking everything else.
@Public()
@BypassMaintenance()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findOne() {
    return this.settingsService.getSettings();
  }
}
