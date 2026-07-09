import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';
import { prismaError } from 'src/utils/prismaError';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSettings } from 'prisma/generated/client';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSettings(): Promise<AppSettings> {
    const cached = await this.cache.get<AppSettings>(CACHE_KEYS.APP_SETTINGS);
    if (cached) return cached;

    const settings = await this.prisma.appSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    await this.cache.set(CACHE_KEYS.APP_SETTINGS, settings);
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<AppSettings> {
    const current = await this.getSettings();
    const minPrice = dto.minPropertyPrice ?? current.minPropertyPrice;
    const maxPrice = dto.maxPropertyPrice ?? current.maxPropertyPrice;
    if (
      minPrice != null &&
      maxPrice != null &&
      Number(minPrice) > Number(maxPrice)
    ) {
      throw new BadRequestException(
        'minPropertyPrice cannot be greater than maxPropertyPrice',
      );
    }

    try {
      const settings = await this.prisma.appSettings.update({
        where: { id: 1 },
        data: dto,
      });
      await this.cache.del(CACHE_KEYS.APP_SETTINGS);
      return settings;
    } catch (error) {
      prismaError(error);
    }
  }
}
