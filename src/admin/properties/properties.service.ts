import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'prisma/generated/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindAdminPropertiesDto } from './dto/find-admin-properties.dto';

@Injectable()
export class AdminPropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllProperties(filter: FindAdminPropertiesDto) {
    const {
      isPublished,
      isFeatured,
      isAvailable,
      search,
      landlordId,
      propertyId,
      page = 1,
      limit = 20,
    } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
      ...(search
        ? { title: { contains: search, mode: 'insensitive' as const } }
        : {}),
      ...(landlordId ? { userId: landlordId } : {}),
      ...(propertyId ? { id: propertyId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          monthly_price: true,
          isPublished: true,
          isAvailable: true,
          isFeatured: true,
          totalViews: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
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
          _count: { select: { favorites: true, propertyReport: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        ...p,
        favouriteCount: p._count.favorites,
        reportCount: p._count.propertyReport,
        _count: undefined,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPropertyDetail(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            imgUrl: true,
            role: true,
            isVerified: true,
            isLocked: true,
            hasVerifiedBadge: true,
            createdAt: true,
            phones: { select: { phoneNumber: true, type: true } },
          },
        },
        images: {
          select: { id: true, imageKey: true, isCover: true, createdAt: true },
        },
        propertyType: {
          select: { nameEn: true, nameKh: true, icon: true },
        },
        propertyAmenities: {
          select: {
            amenity: {
              select: { nameEn: true, nameKh: true, icon: true },
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
        propertyViews: {
          select: { date: true, views: true },
          orderBy: { date: 'desc' },
        },
        propertyReport: {
          select: {
            id: true,
            description: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { favorites: true } },
      },
    });

    if (!property) throw new NotFoundException('Property not found');

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
      amenities: propertyAmenities.map((p) => p.amenity),
      rules,
      favouriteCount: _count.favorites,
    };
  }
}
