import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class TelegramService {
  private readonly bot: Bot;
  private readonly logger = new Logger(TelegramService.name);
  private readonly adminChatIds: string[];

  constructor(configService: ConfigService) {
    const token = configService.getOrThrow<string>('TG_BOT_TOKEN');
    this.bot = new Bot(token);
    this.adminChatIds = configService
      .getOrThrow<string>('ADMIN_TELEGRAM_CHAT_ID')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram message to ${chatId}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async sendAdminMessage(text: string): Promise<void> {
    const results = await Promise.allSettled(
      this.adminChatIds.map((chatId) => this.sendMessage(chatId, text)),
    );
    const failure = results.find((r) => r.status === 'rejected');
    if (failure && failure.status === 'rejected') {
      throw failure.reason;
    }
  }
}
