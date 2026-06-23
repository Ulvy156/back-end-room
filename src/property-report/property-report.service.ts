import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from 'prisma/generated/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { CreatePropertyReportDto } from './dto/create-property-report.dto';
import { FindPropertyReportsDto } from './dto/find-property-reports.dto';
import { sanitizeRichText } from 'src/utils/sanitizeHtml';

@Injectable()
export class PropertyReportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreatePropertyReportDto,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    if (property.userId === userId) {
      throw new BadRequestException('Cannot report your own property');
    }

    const existing = await this.prisma.propertyReport.findFirst({
      where: { propertyId, userId },
    });
    if (existing) {
      throw new BadRequestException('You have already reported this property');
    }

    try {
      const report = await this.prisma.propertyReport.create({
        data: {
          propertyId,
          userId,
          description: sanitizeRichText(dto.description),
        },
        select: { id: true, description: true, createdAt: true },
      });
      return report;
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll(dto: FindPropertyReportsDto) {
    const { page = 1, limit = 10, propertyId } = dto;
    const skip = (page - 1) * limit;

    const where = propertyId ? { propertyId } : {};

    const [items, total] = await Promise.all([
      this.prisma.propertyReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          description: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          property: {
            select: { id: true, title: true, userId: true },
          },
        },
      }),
      this.prisma.propertyReport.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async remove(id: number, requesterId: string, requesterRole: UserRole) {
    const report = await this.prisma.propertyReport.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Report not found');

    if (report.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.propertyReport.delete({ where: { id } });
  }
}
