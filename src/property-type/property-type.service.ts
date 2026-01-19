import { Inject, Injectable } from '@nestjs/common';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CACHE_KEYS } from 'src/cache/cache.key';

@Injectable()
export class PropertyTypeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(createPropertyTypeDto: CreatePropertyTypeDto) {
    try {
      return await this.prisma.propertyType.create({
        data: createPropertyTypeDto,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll() {
    const cachedData = await this.cache.get(CACHE_KEYS.PROPERTY_TYPE);
    if (cachedData) return cachedData;

    const property = await this.prisma.propertyType.findMany({
      where: {
        isRemoved: false,
      },
      select: {
        id: true,
        nameEn: true,
        nameKh: true,
      },
    });
    await this.cache.set(CACHE_KEYS.PROPERTY_TYPE, property);

    return property;
  }

  async findOne(id: number) {
    return this.prisma.propertyType.findUniqueOrThrow({
      where: { id },
    });
  }

  async update(id: number, updatePropertyTypeDto: UpdatePropertyTypeDto) {
    try {
      return await this.prisma.propertyType.update({
        data: updatePropertyTypeDto,
        where: { id },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} propertyType`;
  }
}
