import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { UserRole } from 'prisma/generated/enums';
import { SettingsService } from 'src/settings/settings.service';
import { getPropertyLimitWindowStart } from 'src/utils/propertyLimitWindow';

@Injectable()
export class AdminLandlordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async resetPostingLimit(landlordId: string) {
    const landlord = await this.prisma.user.findFirst({
      where: { id: landlordId, role: UserRole.LANDLORD },
      select: { id: true },
    });
    if (!landlord) throw new NotFoundException('Landlord not found');

    try {
      return await this.prisma.user.update({
        where: { id: landlordId },
        data: { postLimitResetAt: new Date() },
        select: { id: true, name: true, postLimitResetAt: true },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async getLandlordProperties(landlordId: string) {
    const landlord = await this.prisma.user.findFirst({
      where: { id: landlordId, role: UserRole.LANDLORD },
      select: {
        id: true,
        name: true,
        email: true,
        imgUrl: true,
        createdAt: true,
        postLimitResetAt: true,
      },
    });

    if (!landlord) throw new NotFoundException('Landlord not found');

    const settings = await this.settingsService.getSettings();
    const { postLimitResetAt, ...landlordProfile } = landlord;

    const properties = await this.prisma.property.findMany({
      where: { userId: landlordId },
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
        _count: { select: { favorites: true } },
      },
    });

    const since = getPropertyLimitWindowStart(postLimitResetAt);
    const propertiesThisMonth = properties.filter(
      (p) => p.createdAt >= since,
    ).length;

    return {
      landlord: landlordProfile,
      postingLimit: {
        monthlyLimit: settings.maxPropertiesPerLandlord,
        propertiesThisMonth,
        propertiesRemaining: Math.max(
          settings.maxPropertiesPerLandlord - propertiesThisMonth,
          0,
        ),
        resetAt: postLimitResetAt,
      },
      properties: properties.map((p) => ({
        ...p,
        favouriteCount: p._count.favorites,
        _count: undefined,
      })),
    };
  }
}
