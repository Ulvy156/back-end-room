import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { AppSetting } from 'prisma/generated/client';

function makeSetting(overrides: Partial<AppSetting>): AppSetting {
  return {
    id: 'id',
    category: 'property',
    key: 'maxImagesPerProperty',
    value: 5,
    description: null,
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    appSetting: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const rows: AppSetting[] = [
    makeSetting({
      category: 'system',
      key: 'maintenanceMode',
      value: false,
      isPublic: true,
    }),
    makeSetting({
      category: 'auth',
      key: 'limitAddPhoneNumber',
      value: 3,
      isPublic: false,
    }),
    makeSetting({
      category: 'property',
      key: 'minPropertyPrice',
      value: 30,
      isPublic: true,
    }),
    makeSetting({
      category: 'property',
      key: 'maxPropertyPrice',
      value: 2000,
      isPublic: true,
    }),
  ];

  beforeEach(async () => {
    prisma = {
      appSetting: {
        findMany: jest.fn().mockResolvedValue(rows),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe('get / getOne', () => {
    it('returns the value for a known setting', async () => {
      await expect(service.get('system', 'maintenanceMode')).resolves.toBe(
        false,
      );
    });

    it('returns undefined when the setting is missing', async () => {
      await expect(
        service.get('property', 'doesNotExist'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getByCategory', () => {
    it('returns only rows in that category', async () => {
      const result = await service.getByCategory('property');
      expect(result.map((r) => r.key).sort()).toEqual([
        'maxPropertyPrice',
        'minPropertyPrice',
      ]);
    });
  });

  describe('public filtering', () => {
    it('getAllPublic only returns isPublic rows', async () => {
      const result = await service.getAllPublic();
      expect(result.every((r) => r.isPublic)).toBe(true);
      expect(
        result.find((r) => r.key === 'limitAddPhoneNumber'),
      ).toBeUndefined();
    });

    it('getPublicByCategory only returns isPublic rows in that category', async () => {
      const result = await service.getPublicByCategory('auth');
      expect(result).toEqual([]);
    });
  });

  describe('cache-loading behavior', () => {
    it('loads from the DB on a cache miss', async () => {
      await service.get('system', 'maintenanceMode');
      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it('does not hit the DB again on a second read with no intervening write', async () => {
      cache.get.mockResolvedValueOnce(null).mockResolvedValue(rows);

      await service.get('system', 'maintenanceMode');
      await service.get('auth', 'limitAddPhoneNumber');
      await service.getByCategory('property');

      expect(prisma.appSetting.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('creates a new setting', async () => {
      const created = makeSetting({
        category: 'property',
        key: 'newFlag',
        value: true,
      });
      prisma.appSetting.create.mockResolvedValue(created);

      const result = await service.create({
        category: 'property',
        key: 'newFlag',
        value: true,
      });

      expect(result).toEqual(created);
      expect(cache.del).toHaveBeenCalled();
    });

    it('throws ConflictException for a duplicate category+key', async () => {
      await expect(
        service.create({
          category: 'system',
          key: 'maintenanceMode',
          value: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('merges partial fields on an existing setting', async () => {
      const updated = makeSetting({
        category: 'system',
        key: 'maintenanceMode',
        value: true,
      });
      prisma.appSetting.update.mockResolvedValue(updated);

      const result = await service.update('system', 'maintenanceMode', {
        value: true,
      });

      expect(result).toEqual(updated);
      expect(prisma.appSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category_key: { category: 'system', key: 'maintenanceMode' },
          },
        }),
      );
    });

    it('throws NotFoundException when the setting does not exist', async () => {
      await expect(
        service.update('property', 'doesNotExist', { value: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing setting', async () => {
      await service.delete('system', 'maintenanceMode');
      expect(prisma.appSetting.delete).toHaveBeenCalledWith({
        where: { category_key: { category: 'system', key: 'maintenanceMode' } },
      });
      expect(cache.del).toHaveBeenCalled();
    });

    it('throws NotFoundException when the setting does not exist', async () => {
      await expect(
        service.delete('property', 'doesNotExist'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('SETTING_DEFINITIONS validation', () => {
    it('rejects a non-integer value for a known integer setting', async () => {
      await expect(
        service.create({
          category: 'property',
          key: 'maxImagesPerProperty',
          value: 'five',
        }),
      ).rejects.toThrow('Invalid value for setting');
    });
  });

  describe('min/max price cross-field check', () => {
    it('rejects maxPropertyPrice below the currently-stored minPropertyPrice', async () => {
      // stored minPropertyPrice is 30
      await expect(
        service.update('property', 'maxPropertyPrice', { value: 20 }),
      ).rejects.toThrow(
        'minPropertyPrice cannot be greater than maxPropertyPrice',
      );
    });

    it('rejects minPropertyPrice above the currently-stored maxPropertyPrice', async () => {
      // stored maxPropertyPrice is 2000
      await expect(
        service.update('property', 'minPropertyPrice', { value: 2500 }),
      ).rejects.toThrow(
        'minPropertyPrice cannot be greater than maxPropertyPrice',
      );
    });
  });
});
