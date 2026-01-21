import { Injectable } from '@nestjs/common';
import { CreatePropertyRuleDto } from './dto/create-property-rule.dto';
import { UpdatePropertyRuleDto } from './dto/update-property-rule.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { prismaError } from 'src/utils/prismaError';
import { CACHE_KEYS } from 'src/cache/cache.key';

@Injectable()
export class PropertyRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(createPropertyRuleDto: CreatePropertyRuleDto) {
    try {
      return await this.prisma.propertyRules.create({
        data: createPropertyRuleDto,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll() {
    const cacheData = await this.cache.get(CACHE_KEYS.PROPERTY_RULES);
    if (cacheData) return cacheData;

    const propertyRules = await this.prisma.propertyRules.findMany({
      take: 6,
    });
    await this.cache.set(CACHE_KEYS.PROPERTY_RULES, propertyRules);
    return propertyRules;
  }

  findOne(id: number) {
    return `This action returns a #${id} propertyRule`;
  }

  update(id: number, updatePropertyRuleDto: UpdatePropertyRuleDto) {
    return `This action updates a #${id} propertyRule`;
  }

  remove(id: number) {
    return `This action removes a #${id} propertyRule`;
  }
}
