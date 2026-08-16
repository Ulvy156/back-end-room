import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // email address, phone number, or Telegram @handle

  @IsString()
  @MinLength(1)
  password: string;
}
