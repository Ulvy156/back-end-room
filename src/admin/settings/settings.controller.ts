import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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
  findAll() {
    return this.settingsService.getAll();
  }

  @Get(':category')
  findByCategory(@Param('category') category: string) {
    return this.settingsService.getByCategory(category);
  }

  @Get(':category/:key')
  async findOne(
    @Param('category') category: string,
    @Param('key') key: string,
  ) {
    const setting = await this.settingsService.getOne(category, key);
    if (!setting) {
      throw new NotFoundException(`Setting not found: ${category}.${key}`);
    }
    return setting;
  }

  @Post()
  create(@Body() dto: CreateSettingDto) {
    return this.settingsService.create(dto);
  }

  @Patch(':category/:key')
  update(
    @Param('category') category: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.update(category, key, dto);
  }

  @Delete(':category/:key')
  remove(@Param('category') category: string, @Param('key') key: string) {
    return this.settingsService.delete(category, key);
  }
}
