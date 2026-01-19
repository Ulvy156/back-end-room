import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async getLocationSuggestions(q: string) {
    const districts = await this.prisma.district.findMany({
      where: {
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameKh: { contains: q } },
        ],
      },
      take: 10,
    });

    const provinces = await this.prisma.province.findMany({
      where: {
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameKh: { contains: q } },
        ],
      },
      take: 5,
    });

    return [
      ...districts.map((d) => ({
        id: d.id,
        nameEn: d.nameEn,
        nameKh: d.nameKh,
        type: 'district' as const,
      })),
      ...provinces.map((p) => ({
        id: p.id,
        nameEn: p.nameEn,
        nameKh: p.nameKh,
        type: 'province' as const,
      })),
    ];
  }
}
