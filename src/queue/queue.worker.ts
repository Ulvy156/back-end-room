import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../notification/email.service';
import { TelegramService } from '../notification/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  IncrementPropertyViewJob,
  QUEUE_JOBS,
  SendErrorAlertJob,
  SendFeedbackNotificationJob,
  SendOtpEmailJob,
  SendOtpTelegramJob,
  SendPropertyReportAdminAlertJob,
  SendPropertyReportedEmailJob,
  SendPropertyReportedTelegramJob,
  SendVerificationOtpJob,
  WriteAuditLogJob,
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
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.queue.ready;
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

    await this.queue.work<SendFeedbackNotificationJob>(
      QUEUE_JOBS.SEND_FEEDBACK_NOTIFICATION,
      async (jobs) => {
        const job = jobs[0];
        const { type, userName, description } = job.data;
        await this.telegram.sendAdminMessage(
          `📬 *New Feedback — ${String(type)}*\n\nFrom: ${String(userName)}\n\n${String(description)}`,
        );
      },
    );

    await this.queue.work<SendPropertyReportedTelegramJob>(
      QUEUE_JOBS.SEND_PROPERTY_REPORTED_TELEGRAM,
      async (jobs) => {
        const job = jobs[0];
        const { chatId, propertyId, propertyTitle, reportTypeName } = job.data;
        const frontendUrl = this.config.getOrThrow<string>('FRONT_END_URL');
        await this.telegram.sendMessage(
          chatId,
          `⚠️ *Your listing was reported*\n\nProperty: ${propertyTitle} (ID: ${propertyId})\nReason: ${reportTypeName}\nLink: ${frontendUrl}/properties/details/${propertyId}\n\nPlease review your listing.`,
        );
      },
    );

    await this.queue.work<SendPropertyReportedEmailJob>(
      QUEUE_JOBS.SEND_PROPERTY_REPORTED_EMAIL,
      async (jobs) => {
        const job = jobs[0];
        const { to, ownerName, propertyId, propertyTitle, reportTypeName } =
          job.data;
        await this.email.sendPropertyReported(
          to,
          ownerName,
          propertyId,
          propertyTitle,
          reportTypeName,
        );
      },
    );

    await this.queue.work<SendPropertyReportAdminAlertJob>(
      QUEUE_JOBS.SEND_PROPERTY_REPORT_ADMIN_ALERT,
      async (jobs) => {
        const job = jobs[0];
        const { propertyId, propertyTitle, reportTypeName, reporterName } =
          job.data;
        const frontendUrl = this.config.getOrThrow<string>('FRONT_END_URL');
        await this.telegram.sendAdminMessage(
          `🚩 *Property Reported — ${reportTypeName}*\n\nProperty: ${propertyTitle} (ID: ${propertyId})\nReported by: ${reporterName}\nLink: ${frontendUrl}/properties/details/${propertyId}`,
        );
      },
    );

    await this.queue.work<WriteAuditLogJob>(
      QUEUE_JOBS.WRITE_AUDIT_LOG,
      async (jobs) => {
        const job = jobs[0];
        await this.prisma.auditLog.create({
          data: {
            userId: job.data.userId,
            action: job.data.action,
            route: job.data.route,
            resourceType: job.data.resourceType,
            resourceId: job.data.resourceId,
            statusCode: job.data.statusCode,
            ipAddress: job.data.ipAddress,
            userAgent: job.data.userAgent,
          },
        });
      },
    );

    await this.queue.work<SendErrorAlertJob>(
      QUEUE_JOBS.SEND_ERROR_ALERT,
      async (jobs) => {
        const job = jobs[0];
        const { message, method, route, timestamp } = job.data;

        // Plain text — the message/route come from arbitrary error text (e.g. Prisma
        // messages with backticks/underscores) and would break Markdown parsing.
        await this.telegram.sendAdminMessage(
          `🔥 Server Error\n\n${method} ${route}\n${message}\n\n${timestamp}`,
          { parseMode: false },
        );
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
