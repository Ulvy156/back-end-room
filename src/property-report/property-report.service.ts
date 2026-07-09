import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhoneNumberType, UserRole } from 'prisma/generated/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import {
  QUEUE_JOBS,
  SendPropertyReportAdminAlertJob,
  SendPropertyReportedEmailJob,
  SendPropertyReportedTelegramJob,
} from 'src/queue/queue.jobs';
import { prismaError } from 'src/utils/prismaError';
import { CreatePropertyReportDto } from './dto/create-property-report.dto';
import { FindPropertyReportsDto } from './dto/find-property-reports.dto';
import { sanitizeRichText } from 'src/utils/sanitizeHtml';

@Injectable()
export class PropertyReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async create(
    userId: string,
    propertyId: string,
    dto: CreatePropertyReportDto,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phones: {
              where: { type: PhoneNumberType.TELEGRAM },
              select: { phoneNumber: true },
            },
          },
        },
      },
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
          reportTypeId: dto.reportTypeId,
          description: sanitizeRichText(dto.description),
        },
        select: {
          id: true,
          description: true,
          createdAt: true,
          reportType: {
            select: { id: true, nameEn: true, nameKh: true, icon: true },
          },
          user: { select: { name: true } },
        },
      });

      await this.queue.send<SendPropertyReportAdminAlertJob>(
        QUEUE_JOBS.SEND_PROPERTY_REPORT_ADMIN_ALERT,
        {
          propertyId,
          propertyTitle: property.title,
          reportTypeName: report.reportType.nameEn,
          reporterName: report.user.name,
        },
      );

      const telegramPhone = property.user.phones[0];
      if (telegramPhone) {
        await this.queue.send<SendPropertyReportedTelegramJob>(
          QUEUE_JOBS.SEND_PROPERTY_REPORTED_TELEGRAM,
          {
            chatId: telegramPhone.phoneNumber,
            ownerName: property.user.name,
            propertyId,
            propertyTitle: property.title,
            reportTypeName: report.reportType.nameEn,
          },
        );
      } else {
        await this.queue.send<SendPropertyReportedEmailJob>(
          QUEUE_JOBS.SEND_PROPERTY_REPORTED_EMAIL,
          {
            to: property.user.email,
            ownerName: property.user.name,
            propertyId,
            propertyTitle: property.title,
            reportTypeName: report.reportType.nameEn,
          },
        );
      }

      return report;
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll(dto: FindPropertyReportsDto) {
    const { page = 1, limit = 10, propertyId, reportTypeId } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(propertyId && { propertyId }),
      ...(reportTypeId && { reportTypeId }),
    };

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
          reportType: {
            select: { id: true, nameEn: true, nameKh: true, icon: true },
          },
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

  async findOne(id: number) {
    const report = await this.prisma.propertyReport.findUnique({
      where: { id },
      select: {
        id: true,
        description: true,
        createdAt: true,
        reportType: {
          select: { id: true, nameEn: true, nameKh: true, icon: true },
        },
        user: { select: { id: true, name: true, email: true, imgUrl: true } },
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            monthly_price: true,
            isPublished: true,
            isAvailable: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
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
            propertyType: {
              select: { nameEn: true, nameKh: true, icon: true },
            },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
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
