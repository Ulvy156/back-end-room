import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { QUEUE_JOBS, SendFeedbackNotificationJob } from 'src/queue/queue.jobs';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { prismaError } from 'src/utils/prismaError';
import { TranslationService } from 'src/i18n/translation.service';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly translation: TranslationService,
  ) {}

  // [USER] Submit feedback — stores in DB and notifies admin via Telegram
  async create(userId: string, dto: CreateFeedbackDto) {
    try {
      const feedback = await this.prisma.feedback.create({
        data: { userId, type: dto.type, description: dto.description },
        include: { user: { select: { name: true } } },
      });

      await this.queue.send<SendFeedbackNotificationJob>(
        QUEUE_JOBS.SEND_FEEDBACK_NOTIFICATION,
        {
          type: feedback.type,
          description: feedback.description,
          userName: feedback.user.name,
        },
      );

      return { message: this.translation.t('messages.feedback.submitted') };
    } catch (error) {
      prismaError(error);
    }
  }

  // [ADMIN] List all feedback ordered by newest first
  async findAll() {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
