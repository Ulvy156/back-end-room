import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from 'prisma/generated/enums';

@Injectable()
export class AdminService {
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

      recentRegistrations,
      latestProperties,
      topProperties,
      recentFeedback,
    ] = await Promise.all([
      // ── User stats ──────────────────────────────────────────────────────────
      this.prisma.user.count({ where: { role: UserRole.USER } }),
      this.prisma.user.count({ where: { role: UserRole.LANDLORD } }),
      this.prisma.user.count({ where: { isLocked: true } }),
      this.prisma.user.count({ where: { isVerified: false } }),
      this.prisma.user.count({ where: { role: UserRole.USER, createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { role: UserRole.LANDLORD, createdAt: { gte: since } } }),

      // ── Property stats ───────────────────────────────────────────────────────
      this.prisma.property.count(),
      this.prisma.property.count({ where: { isPublished: true } }),
      this.prisma.property.count({ where: { isPublished: false } }),
      this.prisma.property.count({ where: { isAvailable: false } }),
      this.prisma.property.count({ where: { isFeatured: true } }),
      this.prisma.property.count({ where: { createdAt: { gte: since } } }),

      // ── Feedback breakdown ───────────────────────────────────────────────────
      this.prisma.feedback.groupBy({
        by: ['type'],
        _count: { id: true },
      }),

      // ── Recent registrations (last 5, excluding admins) ──────────────────────
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

      // ── Latest property listings (last 5) ───────────────────────────────────
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

      // ── Top 5 properties by views ────────────────────────────────────────────
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

      // ── Recent feedback (last 5) ─────────────────────────────────────────────
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

    // Reshape feedback breakdown into { BUG: n, SUGGESTION: n, OTHER: n }
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

  async getLandlordProperties(landlordId: string) {
    const landlord = await this.prisma.user.findFirst({
      where: { id: landlordId, role: UserRole.LANDLORD },
      select: { id: true, name: true, email: true, imgUrl: true, createdAt: true },
    });

    if (!landlord) throw new NotFoundException('Landlord not found');

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

    return {
      landlord,
      properties: properties.map((p) => ({
        ...p,
        favouriteCount: p._count.favorites,
        _count: undefined,
      })),
    };
  }
}
