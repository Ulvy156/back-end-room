import { IsEmail, IsIn } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;

  @IsIn(['telegram', 'email'])
  channel: 'telegram' | 'email';
}
