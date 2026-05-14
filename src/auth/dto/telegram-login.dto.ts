import { IsNumber, IsString, IsOptional } from 'class-validator';

export class TelegramLoginDto {
  @IsNumber()
  id: number; // Telegram user ID — used to look up the linked account

  @IsString()
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsNumber()
  auth_date: number; // Unix timestamp — server checks this is within 24 hours

  @IsString()
  hash: string; // HMAC-SHA256 signature from Telegram — verified server-side
}
