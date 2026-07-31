import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';
import { prismaError } from 'src/utils/prismaError';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { Prisma } from 'prisma/generated/client';

// Flat, named shape for the known settings, plus an index signature so a key
// added later via seed (e.g. a future `seo` group) is readable without a
// type change here.
export interface AppSettingsMap {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxPropertiesPerLandlord: number;
  maxImagesPerProperty: number;
  minPropertyPrice: number | null;
  maxPropertyPrice: number | null;
  limitAddPhoneNumber: number;
  [key: string]: unknown;
}

type SettingValidator = (value: unknown) => boolean;

// One entry per key that needs bounds/shape checking beyond "same JS type as
// the value currently stored". A brand-new simple setting (e.g. a boolean
// flag) needs no entry here — it falls back to matchesCurrentType() below.
const SETTING_VALIDATORS: Record<string, SettingValidator> = {
  maintenanceMode: (v) => typeof v === 'boolean',
  registrationEnabled: (v) => typeof v === 'boolean',
  maxPropertiesPerLandlord: (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  maxImagesPerProperty: (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  limitAddPhoneNumber: (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  minPropertyPrice: (v) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0),
  maxPropertyPrice: (v) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0),
};

function matchesCurrentType(current: unknown, value: unknown): boolean {
  if (Array.isArray(current)) return Array.isArray(value);
  return typeof value === typeof current;
}

// The global ValidationPipe intentionally skips these endpoints' bodies (see
// dto/update-setting.dto.ts) since `value` can be any JSON type — which also
// means it does zero shape-checking for us. Guard it ourselves.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSettings(): Promise<AppSettingsMap> {
    const cached = await this.cache.get<AppSettingsMap>(
      CACHE_KEYS.APP_SETTINGS,
    );
    if (cached) return cached;

    const rows = await this.prisma.appSetting.findMany();
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as AppSettingsMap);

    await this.cache.set(CACHE_KEYS.APP_SETTINGS, settings);
    return settings;
  }

  async updateSetting(
    key: string,
    dto: UpdateSettingDto,
  ): Promise<AppSettingsMap> {
    if (!isPlainObject(dto) || !('value' in dto)) {
      throw new BadRequestException('value is required');
    }

    const current = await this.getSettings();
    if (!(key in current)) {
      throw new BadRequestException(`Unknown setting: ${key}`);
    }

    const validate =
      SETTING_VALIDATORS[key] ??
      ((v: unknown) => matchesCurrentType(current[key], v));
    if (!validate(dto.value)) {
      throw new BadRequestException(`Invalid value for setting: ${key}`);
    }

    // Cross-field invariant — not expressible by a single per-key validator.
    // Merge with `current` so updating only one of the two fields is still
    // checked against the other's stored value.
    if (key === 'minPropertyPrice' || key === 'maxPropertyPrice') {
      const nextMin =
        key === 'minPropertyPrice'
          ? (dto.value as number | null)
          : current.minPropertyPrice;
      const nextMax =
        key === 'maxPropertyPrice'
          ? (dto.value as number | null)
          : current.maxPropertyPrice;
      if (nextMin != null && nextMax != null && nextMin > nextMax) {
        throw new BadRequestException(
          'minPropertyPrice cannot be greater than maxPropertyPrice',
        );
      }
    }

    try {
      await this.prisma.appSetting.update({
        where: { key },
        data: {
          value:
            dto.value === null
              ? Prisma.JsonNull
              : (dto.value as Prisma.InputJsonValue),
        },
      });
      await this.cache.del(CACHE_KEYS.APP_SETTINGS);
    } catch (error) {
      prismaError(error);
    }

    return this.getSettings();
  }

  async createSetting(dto: CreateSettingDto): Promise<AppSettingsMap> {
    if (!isPlainObject(dto)) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const { key, group } = dto;
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new BadRequestException(
        'key is required and must be a non-empty string',
      );
    }
    if (typeof group !== 'string' || group.trim().length === 0) {
      throw new BadRequestException(
        'group is required and must be a non-empty string',
      );
    }
    if (!('value' in dto)) {
      throw new BadRequestException('value is required');
    }

    const current = await this.getSettings();
    if (key in current) {
      throw new BadRequestException(`Setting already exists: ${key}`);
    }

    try {
      await this.prisma.appSetting.create({
        data: {
          key,
          group,
          value:
            dto.value === null
              ? Prisma.JsonNull
              : (dto.value as Prisma.InputJsonValue),
        },
      });
      await this.cache.del(CACHE_KEYS.APP_SETTINGS);
    } catch (error) {
      prismaError(error);
    }

    return this.getSettings();
  }
}
