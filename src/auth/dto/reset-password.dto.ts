import {
  IsEmail,
  IsNumber,
  IsString,
  IsStrongPassword,
  Length,
  ValidateIf,
} from 'class-validator';

export class ResetPasswordDto {
  // Either `email` or `telegramId` must be present — whichever identifier
  // the matching forgot-password request used.
  @ValidateIf((o: ResetPasswordDto) => o.telegramId === undefined)
  @IsEmail()
  email?: string;

  @ValidateIf((o: ResetPasswordDto) => o.email === undefined)
  @IsNumber()
  telegramId?: number;

  @IsString()
  @Length(6, 6)
  otp: string;

  @IsStrongPassword()
  newPassword: string;
}
