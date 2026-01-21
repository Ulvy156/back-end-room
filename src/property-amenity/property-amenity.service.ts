import { Injectable } from '@nestjs/common';
import { CreatePropertyAmenityDto } from './dto/create-property-amenity.dto';
import { UpdatePropertyAmenityDto } from './dto/update-property-amenity.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';

@Injectable()
export class PropertyAmenityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(createPropertyAmenityDto: CreatePropertyAmenityDto) {
    try {
      return await this.prisma.amenity.create({
        data: createPropertyAmenityDto,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll() {
    const cacheData = await this.cache.get(CACHE_KEYS.AMENITIES);
    if (cacheData) return cacheData;

    const amenities = await this.prisma.amenity.findMany({
      take: 6,
    });
    await this.cache.set(CACHE_KEYS.AMENITIES, amenities);
    return amenities;
  }

  findOne(id: number) {
    return `This action returns a #${id} propertyAmenity`;
  }

  update(id: number, updatePropertyAmenityDto: UpdatePropertyAmenityDto) {
    return `This action updates a #${id} propertyAmenity`;
  }

  remove(id: number) {
    return `This action removes a #${id} propertyAmenity`;
  }
}
