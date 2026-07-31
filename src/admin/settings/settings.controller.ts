import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { SettingsService } from 'src/settings/settings.service';
import { UpdateSettingDto } from 'src/settings/dto/update-setting.dto';
import { CreateSettingDto } from 'src/settings/dto/create-setting.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findOne() {
    return this.settingsService.getSettings();
  }

  @Post()
  create(@Body() dto: CreateSettingDto) {
    return this.settingsService.createSetting(dto);
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.updateSetting(key, dto);
  }
}
