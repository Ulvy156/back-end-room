import { IsIn, IsOptional, IsStrongPassword } from 'class-validator';
import { UserRole } from 'prisma/generated/enums';

export class SelectRoleDto {
  @IsOptional()
  @IsIn([UserRole.USER, UserRole.LANDLORD])
  role?: UserRole;

  @IsOptional()
  @IsStrongPassword()
  password?: string;
}
