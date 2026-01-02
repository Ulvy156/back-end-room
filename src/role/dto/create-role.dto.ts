import { IsEnum } from 'class-validator';
import { UserRole } from 'generated/prisma/enums';

export class CreateRoleDto {
  @IsEnum(UserRole)
  name: UserRole;
}
