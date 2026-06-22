import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from 'prisma/generated/enums';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      totalUsers,
      totalLandlords,
      lockedUsers,
      unverifiedUsers,
      newUsersThisMonth,
      newLandlordsThisMonth,

      totalProperties,
      publishedProperties,
      unpublishedProperties,
      unavailableProperties,
      featuredProperties,
      newPropertiesThisMonth,

      feedbackByType,

      totalViewsAgg,
      totalFavourites,
      totalReports,

      recentRegistrations,
      latestProperties,
      topProperties,
      recentFeedback,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.USER } }),
      this.prisma.user.count({ where: { role: UserRole.LANDLORD } }),
      this.prisma.user.count({ where: { isLocked: true } }),
      this.prisma.user.count({ where: { isVerified: false } }),
      this.prisma.user.count({
        where: { role: UserRole.USER, createdAt: { gte: since } },
      }),
      this.prisma.user.count({
        where: { role: UserRole.LANDLORD, createdAt: { gte: since } },
      }),

      this.prisma.property.count(),
      this.prisma.property.count({ where: { isPublished: true } }),
      this.prisma.property.count({ where: { isPublished: false } }),
      this.prisma.property.count({ where: { isAvailable: false } }),
      this.prisma.property.count({ where: { isFeatured: true } }),
      this.prisma.property.count({ where: { createdAt: { gte: since } } }),

      this.prisma.feedback.groupBy({
        by: ['type'],
        _count: { id: true },
      }),

      this.prisma.property.aggregate({ _sum: { totalViews: true } }),
      this.prisma.favorite.count(),
      this.prisma.propertyReport.count(),

      this.prisma.user.findMany({
        where: { role: { not: UserRole.ADMIN } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isLocked: true,
          createdAt: true,
        },
      }),

      this.prisma.property.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          isPublished: true,
          isFeatured: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          images: {
            take: 1,
            where: { isCover: true },
            select: { imageKey: true },
          },
        },
      }),

      this.prisma.property.findMany({
        where: { isPublished: true },
        orderBy: { totalViews: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          totalViews: true,
          isAvailable: true,
          _count: { select: { favorites: true } },
          images: {
            take: 1,
            where: { isCover: true },
            select: { imageKey: true },
          },
        },
      }),

      this.prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          description: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    const feedbackTotals = feedbackByType.reduce(
      (acc, row) => {
        acc[row.type] = row._count.id;
        return acc;
      },
      { BUG: 0, SUGGESTION: 0, OTHER: 0 } as Record<string, number>,
    );

    return {
      stats: {
        users: {
          total: totalUsers,
          locked: lockedUsers,
          unverified: unverifiedUsers,
          newThisMonth: newUsersThisMonth,
        },
        landlords: {
          total: totalLandlords,
          newThisMonth: newLandlordsThisMonth,
        },
        properties: {
          total: totalProperties,
          published: publishedProperties,
          unpublished: unpublishedProperties,
          unavailable: unavailableProperties,
          featured: featuredProperties,
          featuredMax: 3,
          newThisMonth: newPropertiesThisMonth,
        },
        feedback: {
          total: feedbackByType.reduce((sum, r) => sum + r._count.id, 0),
          byType: feedbackTotals,
        },
        engagement: {
          totalViews: totalViewsAgg._sum.totalViews ?? 0,
          totalFavourites,
          totalReports,
        },
      },
      recentRegistrations,
      latestProperties,
      topProperties: topProperties.map((p) => ({
        ...p,
        favouriteCount: p._count.favorites,
        _count: undefined,
      })),
      recentFeedback,
    };
  }
}
