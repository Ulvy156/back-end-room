import { IsEmail, IsIn, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TelegramLoginDto } from './telegram-login.dto';

export class ForgotPasswordDto {
  @IsIn(['telegram', 'email'])
  channel: 'telegram' | 'email';

  @ValidateIf((o: ForgotPasswordDto) => o.channel === 'email')
  @IsEmail()
  email?: string;

  // Telegram Login Widget payload — proves the requester controls the linked
  // Telegram account, so no email is needed for this channel.
  @ValidateIf((o: ForgotPasswordDto) => o.channel === 'telegram')
  @ValidateNested()
  @Type(() => TelegramLoginDto)
  telegram?: TelegramLoginDto;
}
