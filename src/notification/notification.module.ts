import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { EmailService } from './email.service';

@Module({
  providers: [TelegramService, EmailService],
  exports: [TelegramService, EmailService],
})
export class NotificationModule {}
