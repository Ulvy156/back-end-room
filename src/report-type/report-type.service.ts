import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/cache.service';
import { CACHE_KEYS } from 'src/cache/cache.key';

@Injectable()
export class ReportTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll() {
    const cached = await this.cache.get(CACHE_KEYS.REPORT_TYPES);
    if (cached) return cached;

    const types = await this.prisma.reportType.findMany({
      select: { id: true, code: true, nameEn: true, nameKh: true, icon: true },
    });

    await this.cache.set(CACHE_KEYS.REPORT_TYPES, types);
    return types;
  }
}
