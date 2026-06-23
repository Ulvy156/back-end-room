import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole, PhoneNumberType } from 'prisma/generated/enums';
import { FindLandlordProfileDto } from './dto/find-landlord-profile.dto';

@Injectable()
export class LandlordProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getLandlordProfile(landlordId: string, dto: FindLandlordProfileDto) {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const landlord = await this.prisma.user.findFirst({
      where: { id: landlordId, role: UserRole.LANDLORD },
      select: {
        id: true,
        name: true,
        email: true,
        imgUrl: true,
        createdAt: true,
        showPhone: true,
        showTelegram: true,
        showEmail: true,
        phones: { select: { phoneNumber: true, type: true } },
      },
    });

    if (!landlord) throw new NotFoundException('Landlord not found');

    const where = { userId: landlordId, isPublished: true } as const;

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
          sizeSqm: true,
          totalViews: true,
          bathroom: true,
          bedroom: true,
          isAvailable: true,
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
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const { showPhone, showTelegram, showEmail, phones, email, ...rest } =
      landlord;

    return {
      landlord: {
        ...rest,
        email: showEmail ? email : null,
        phones: phones.filter(
          (p) =>
            (p.type === PhoneNumberType.PHONE && showPhone) ||
            (p.type === PhoneNumberType.TELEGRAM && showTelegram),
        ),
        totalPublishedProperties: total,
      },
      properties: {
        items,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }
}
