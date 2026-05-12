import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';

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

  async getAllProvinces() {
    try {
      return await this.prisma.province.findMany();
    } catch (error) {
      return prismaError(error);
    }
  }

  async getProvinceById(id: number) {
    try {
      return await this.prisma.province.findFirstOrThrow({
        where: { id },
      });
    } catch (error) {
      return prismaError(error);
    }
  }

  async getDistrictById(id: number) {
    try {
      return await this.prisma.district.findFirstOrThrow({
        where: { id },
      });
    } catch (error) {
      return prismaError(error);
    }
  }

  async getDistrictByProvinceId(id: number) {
    try {
      return await this.prisma.district.findFirstOrThrow({
        where: { provinceId: id },
      });
    } catch (error) {
      return prismaError(error);
    }
  }
}
