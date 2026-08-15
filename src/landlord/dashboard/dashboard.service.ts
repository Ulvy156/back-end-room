import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/settings/settings.service';
import { getPropertyLimitWindowStart } from 'src/utils/propertyLimitWindow';

@Injectable()
export class LandlordDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async getDashboard(landlordId: string) {
    const [maxPropertiesPerLandlordSetting, landlord] = await Promise.all([
      this.settingsService.get<number>('property', 'maxPropertiesPerLandlord'),
      this.prisma.user.findUnique({
        where: { id: landlordId },
        select: { postLimitResetAt: true },
      }),
    ]);
    const maxPropertiesPerLandlord =
      maxPropertiesPerLandlordSetting ?? Infinity;
    const since = getPropertyLimitWindowStart(landlord?.postLimitResetAt);

    const [
      totalProperties,
      publishedCount,
      unpublishedCount,
      availableCount,
      unavailableCount,
      propertiesThisMonth,
      totalViewsAgg,
      totalFavourites,
      recentActivity,
      topProperties,
    ] = await Promise.all([
      this.prisma.property.count({ where: { userId: landlordId } }),
      this.prisma.property.count({
        where: { userId: landlordId, isPublished: true },
      }),
      this.prisma.property.count({
        where: { userId: landlordId, isPublished: false },
      }),
      this.prisma.property.count({
        where: { userId: landlordId, isAvailable: true },
      }),
      this.prisma.property.count({
        where: { userId: landlordId, isAvailable: false },
      }),
      this.prisma.property.count({
        where: { userId: landlordId, createdAt: { gte: since } },
      }),
      this.prisma.property.aggregate({
        where: { userId: landlordId },
        _sum: { totalViews: true },
      }),
      this.prisma.favorite.count({
        where: { property: { userId: landlordId } },
      }),

      this.prisma.favorite.findMany({
        where: { property: { userId: landlordId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, name: true, imgUrl: true } },
          property: {
            select: {
              id: true,
              title: true,
              images: {
                take: 1,
                where: { isCover: true },
                select: { imageKey: true },
              },
            },
          },
        },
      }),

      this.prisma.property.findMany({
        where: { userId: landlordId },
        orderBy: { totalViews: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          totalViews: true,
          isPublished: true,
          isAvailable: true,
          _count: { select: { favorites: true } },
          images: {
            take: 1,
            where: { isCover: true },
            select: { imageKey: true },
          },
        },
      }),
    ]);

    return {
      stats: {
        totalProperties,
        published: publishedCount,
        unpublished: unpublishedCount,
        available: availableCount,
        unavailable: unavailableCount,
        totalViews: totalViewsAgg._sum.totalViews ?? 0,
        totalFavourites,
        propertiesThisMonth,
        monthlyLimit: maxPropertiesPerLandlord,
        propertiesRemaining: Math.max(
          maxPropertiesPerLandlord - propertiesThisMonth,
          0,
        ),
        resetAt: landlord?.postLimitResetAt ?? null,
      },
      recentActivity,
      topProperties: topProperties.map((p) => ({
        ...p,
        favouriteCount: p._count.favorites,
        _count: undefined,
      })),
    };
  }
}
