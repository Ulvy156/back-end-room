import { IsIn, IsOptional, IsStrongPassword } from 'class-validator';
import { UserRole } from 'prisma/generated/enums';

export class SelectRoleDto {
  @IsIn([UserRole.USER, UserRole.LANDLORD])
  role: UserRole;

  // Only accepted for accounts auto-created via Telegram/Google that have no real password yet
  @IsOptional()
  @IsStrongPassword()
  password?: string;
}
