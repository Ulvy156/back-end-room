import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { UserRole } from 'prisma/generated/enums';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;

  // Users cannot self-assign ADMIN — only USER or LANDLORD allowed
  @IsOptional()
  @IsIn([UserRole.USER, UserRole.LANDLORD])
  role?: UserRole;
}
