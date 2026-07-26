import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from 'prisma/generated/enums';

@Injectable()
export class AdminLandlordsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLandlordProperties(landlordId: string) {
    const landlord = await this.prisma.user.findFirst({
      where: { id: landlordId, role: UserRole.LANDLORD },
      select: {
        id: true,
        name: true,
        email: true,
        imgUrl: true,
        createdAt: true,
      },
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
