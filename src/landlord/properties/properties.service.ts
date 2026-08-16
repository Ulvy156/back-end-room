import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'prisma/generated/client';
import { UserRole } from 'prisma/generated/enums';
import { TranslationService } from 'src/i18n/translation.service';
import { FindLandlordPropertiesDto } from './dto/find-landlord-properties.dto';

@Injectable()
export class LandlordPropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
  ) {}

  async getProperties(landlordId: string, filter: FindLandlordPropertiesDto) {
    const {
      isPublished,
      isAvailable,
      isFeatured,
      propertyTypeId,
      districtId,
      provinceId,
      minPrice,
      maxPrice,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      userId: landlordId,
      isPublished,
      isAvailable,
      isFeatured,
      propertyTypeId,
      districtId,
      ...(provinceId && { district: { provinceId } }),
      ...((minPrice !== undefined || maxPrice !== undefined) && {
        monthly_price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      }),
      ...(search && {
        title: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          title: true,
          monthly_price: true,
          isPublished: true,
          isAvailable: true,
          isFeatured: true,
          isLocked: true,
          totalViews: true,
          contactCount: true,
          openTime: true,
          closeTime: true,
          createdAt: true,
          images: {
            take: 1,
            where: { isCover: true },
            select: { imageKey: true },
          },
          district: {
            select: {
              nameEn: true,
              nameKh: true,
              province: { select: { nameEn: true, nameKh: true } },
            },
          },
          propertyType: { select: { nameEn: true, nameKh: true, icon: true } },
          propertyReport: {
            orderBy: { createdAt: 'desc' as const },
            select: {
              id: true,
              description: true,
              createdAt: true,
              reportType: {
                select: { nameEn: true, nameKh: true, icon: true },
              },
            },
          },
          _count: { select: { favorites: true, propertyReport: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...p }) => ({
        ...p,
        favouriteCount: _count.favorites,
        reportCount: _count.propertyReport,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPropertyDetail(
    propertyId: string,
    requesterId: string,
    role: UserRole,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        images: { select: { id: true, imageKey: true, isCover: true } },
        propertyType: { select: { nameEn: true, nameKh: true, icon: true } },
        propertyAmenities: {
          select: {
            amenity: {
              select: { id: true, nameEn: true, nameKh: true, icon: true },
            },
          },
        },
        district: {
          select: {
            nameEn: true,
            nameKh: true,
            province: { select: { nameEn: true, nameKh: true } },
          },
        },
        propertyRuleValue: {
          select: {
            rule: {
              select: { id: true, nameEn: true, nameKh: true, icon: true },
            },
          },
        },
        parkings: {
          select: {
            id: true,
            type: true,
            slots: true,
            isFree: true,
            price: true,
            note: true,
          },
        },
        propertyReport: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            description: true,
            createdAt: true,
            user: { select: { id: true, name: true, imgUrl: true } },
          },
        },
        _count: { select: { favorites: true, propertyReport: true } },
      },
    });

    if (!property)
      throw new NotFoundException(
        this.translation.t('errors.property.not_found'),
      );
    if (property.userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.property.forbidden'),
      );

    const allRules = await this.prisma.propertyRules.findMany({
      select: { id: true, nameEn: true, nameKh: true, icon: true },
    });

    const selectedRuleIds = new Set(
      property.propertyRuleValue.map((prv) => prv.rule.id),
    );

    const rules = allRules.map((rule) => ({
      nameEn: rule.nameEn,
      nameKh: rule.nameKh,
      icon: rule.icon,
      is_allow: selectedRuleIds.has(rule.id),
    }));

    const { propertyAmenities, propertyRuleValue, _count, ...rest } = property;

    return {
      ...rest,
      amenities: propertyAmenities.map((pa) => pa.amenity),
      rules,
      favouriteCount: _count.favorites,
      reportCount: _count.propertyReport,
    };
  }
}
