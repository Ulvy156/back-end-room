import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class TelegramService {
  private readonly bot: Bot;
  private readonly logger = new Logger(TelegramService.name);

  constructor(configService: ConfigService) {
    const token = configService.getOrThrow<string>('TG_BOT_TOKEN');
    this.bot = new Bot(token);
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error(`Failed to send Telegram message to ${chatId}`, error);
      throw error;
    }
  }
}
