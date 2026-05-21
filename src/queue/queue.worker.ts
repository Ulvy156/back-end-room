import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailService } from '../notification/email.service';
import { TelegramService } from '../notification/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  IncrementPropertyViewJob,
  QUEUE_JOBS,
  SendOtpEmailJob,
  SendOtpTelegramJob,
  SendVerificationOtpJob,
} from './queue.jobs';
import { QueueService } from './queue.service';

@Injectable()
export class QueueWorker implements OnModuleInit {
  private readonly logger = new Logger(QueueWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly email: EmailService,
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.registerWorkers();
    await this.scheduleRecurringJobs();
  }

  private async registerWorkers() {
    await this.queue.work<SendVerificationOtpJob>(
      QUEUE_JOBS.SEND_VERIFICATION_OTP,
      async (jobs) => {
        const job = jobs[0];
        await this.email.sendVerificationOtp(job.data.to, job.data.otp);
      },
    );

    await this.queue.work<SendOtpEmailJob>(
      QUEUE_JOBS.SEND_OTP_EMAIL,
      async (jobs) => {
        const job = jobs[0];
        await this.email.sendOtp(job.data.to, job.data.otp);
      },
    );

    await this.queue.work<SendOtpTelegramJob>(
      QUEUE_JOBS.SEND_OTP_TELEGRAM,
      async (jobs) => {
        const job = jobs[0];
        await this.telegram.sendMessage(
          job.data.chatId,
          `🔐 *Rent Room — Password Reset*\n\nYour OTP is: *${job.data.otp}*\n\nExpires in 10 minutes. Do not share this with anyone.`,
        );
      },
    );

    await this.queue.work<IncrementPropertyViewJob>(
      QUEUE_JOBS.INCREMENT_PROPERTY_VIEW,
      async (jobs) => {
        const job = jobs[0];
        await this.prisma.property.update({
          data: { totalViews: { increment: 1 } },
          where: { id: job.data.propertyId },
        });
      },
    );

    await this.queue.work(QUEUE_JOBS.PURGE_EXPIRED_TOKENS, async () => {
      const now = new Date();
      const [refreshResult, otpResult] = await Promise.all([
        this.prisma.refreshToken.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
      ]);
      this.logger.log(
        `Purged ${refreshResult.count} refresh tokens and ${otpResult.count} OTP records`,
      );
    });
  }

  private async scheduleRecurringJobs() {
    await this.queue.schedule(QUEUE_JOBS.PURGE_EXPIRED_TOKENS, '0 2 * * *');
  }
}
