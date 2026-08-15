import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';
import { prismaError } from 'src/utils/prismaError';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { CreateSettingDto } from './dto/create-setting.dto';
import { AppSetting, Prisma } from 'prisma/generated/client';

// AppSetting is for application configuration/behavior — feature flags,
// limits, defaults. Never store secrets here (DATABASE_URL, JWT_SECRET,
// R2_SECRET, etc.) — those stay in env/secret management.

type SettingValidator = (value: unknown) => boolean;

// One entry per known setting that needs bounds/shape checking, keyed by
// `${category}:${key}`. A brand-new setting created via the admin API with
// no entry here isn't validated beyond "value is present" — add an entry
// when a setting needs real constraints.
const SETTING_DEFINITIONS: Record<string, SettingValidator> = {
  'system:maintenanceMode': (v) => typeof v === 'boolean',
  'auth:registrationEnabled': (v) => typeof v === 'boolean',
  'auth:limitAddPhoneNumber': (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  'property:maxPropertiesPerLandlord': (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  'property:maxImagesPerProperty': (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  'property:maxDraftsPerLandlord': (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1,
  'property:minPropertyPrice': (v) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0),
  'property:maxPropertyPrice': (v) =>
    v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0),
};

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async loadAll(): Promise<AppSetting[]> {
    const cached = await this.cache.get<AppSetting[]>(CACHE_KEYS.APP_SETTINGS);
    if (cached) return cached;

    const rows = await this.prisma.appSetting.findMany();
    await this.cache.set(CACHE_KEYS.APP_SETTINGS, rows);
    return rows;
  }

  private async invalidate() {
    await this.cache.del(CACHE_KEYS.APP_SETTINGS);
  }

  // Full row for one setting. Use get() below for the common case of just
  // wanting the value.
  async getOne(category: string, key: string): Promise<AppSetting | null> {
    const all = await this.loadAll();
    return all.find((s) => s.category === category && s.key === key) ?? null;
  }

  // Single-setting read. Prefer this over getByCategory() unless a call site
  // genuinely needs several keys from one category as one consistent
  // snapshot (see property.service.ts's assertPriceInRange) — the shared
  // cache means calling this N times costs no extra queries either way, so
  // this isn't a performance tradeoff, just what's simplest to read.
  async get<T>(category: string, key: string): Promise<T | undefined> {
    const row = await this.getOne(category, key);
    return row ? (row.value as T) : undefined;
  }

  // All rows in a category (public + private) — for admin, or for a call
  // site that needs a consistent multi-key snapshot.
  async getByCategory(category: string): Promise<AppSetting[]> {
    const all = await this.loadAll();
    return all.filter((s) => s.category === category);
  }

  async getPublicByCategory(category: string): Promise<AppSetting[]> {
    const all = await this.loadAll();
    return all.filter((s) => s.category === category && s.isPublic);
  }

  async getAll(): Promise<AppSetting[]> {
    return this.loadAll();
  }

  async getAllPublic(): Promise<AppSetting[]> {
    const all = await this.loadAll();
    return all.filter((s) => s.isPublic);
  }

  private validate(category: string, key: string, value: unknown) {
    const validate = SETTING_DEFINITIONS[`${category}:${key}`];
    if (validate && !validate(value)) {
      throw new BadRequestException(
        `Invalid value for setting: ${category}.${key}`,
      );
    }
  }

  // Cross-field invariant for property.minPropertyPrice / maxPropertyPrice —
  // always re-reads the counterpart key's currently-stored value, so it
  // catches an out-of-order update from either side (e.g. lowering maxPrice
  // below an existing minPrice, not just raising minPrice above maxPrice).
  private async assertPriceBoundsConsistent(
    category: string,
    key: string,
    value: unknown,
  ) {
    if (category !== 'property') return;
    if (key !== 'minPropertyPrice' && key !== 'maxPropertyPrice') return;

    const counterpartKey =
      key === 'minPropertyPrice' ? 'maxPropertyPrice' : 'minPropertyPrice';
    const counterpart = await this.get<number | null>(
      'property',
      counterpartKey,
    );

    const min =
      key === 'minPropertyPrice' ? (value as number | null) : counterpart;
    const max =
      key === 'maxPropertyPrice' ? (value as number | null) : counterpart;
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'minPropertyPrice cannot be greater than maxPropertyPrice',
      );
    }
  }

  // Internal upsert primitive — not used by the admin create/update
  // endpoints (those check existence explicitly, see create()/update()
  // below, so a typo'd key can't silently create a new setting). Kept for
  // future internal/system use, e.g. a background job flipping a flag.
  async set<T>(category: string, key: string, value: T): Promise<AppSetting> {
    this.validate(category, key, value);
    await this.assertPriceBoundsConsistent(category, key, value);

    try {
      const row = await this.prisma.appSetting.upsert({
        where: { category_key: { category, key } },
        create: { category, key, value: toJsonValue(value) },
        update: { value: toJsonValue(value) },
      });
      await this.invalidate();
      return row;
    } catch (error) {
      prismaError(error);
    }
  }

  async create(dto: CreateSettingDto): Promise<AppSetting> {
    const existing = await this.getOne(dto.category, dto.key);
    if (existing) {
      throw new ConflictException(
        `Setting already exists: ${dto.category}.${dto.key}`,
      );
    }

    this.validate(dto.category, dto.key, dto.value);
    await this.assertPriceBoundsConsistent(dto.category, dto.key, dto.value);

    try {
      const row = await this.prisma.appSetting.create({
        data: {
          category: dto.category,
          key: dto.key,
          value: toJsonValue(dto.value),
          description: dto.description,
          isPublic: dto.isPublic ?? false,
        },
      });
      await this.invalidate();
      return row;
    } catch (error) {
      prismaError(error);
    }
  }

  async update(
    category: string,
    key: string,
    dto: UpdateSettingDto,
  ): Promise<AppSetting> {
    const existing = await this.getOne(category, key);
    if (!existing) {
      throw new NotFoundException(`Setting not found: ${category}.${key}`);
    }

    if ('value' in dto && dto.value !== undefined) {
      this.validate(category, key, dto.value);
      await this.assertPriceBoundsConsistent(category, key, dto.value);
    }

    try {
      const row = await this.prisma.appSetting.update({
        where: { category_key: { category, key } },
        data: {
          ...('value' in dto && dto.value !== undefined
            ? { value: toJsonValue(dto.value) }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        },
      });
      await this.invalidate();
      return row;
    } catch (error) {
      prismaError(error);
    }
  }

  async delete(category: string, key: string): Promise<void> {
    const existing = await this.getOne(category, key);
    if (!existing) {
      throw new NotFoundException(`Setting not found: ${category}.${key}`);
    }

    try {
      await this.prisma.appSetting.delete({
        where: { category_key: { category, key } },
      });
      await this.invalidate();
    } catch (error) {
      prismaError(error);
    }
  }
}
