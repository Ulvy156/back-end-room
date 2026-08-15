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

  // Backward-compat shape for the frontend's appSettings store: a flat
  // { [key]: value } object, not the category-grouped rows the admin API
  // uses. Only isPublic settings are included.
  @Get()
  async findOne() {
    const rows = await this.settingsService.getAllPublic();
    return rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }
}
