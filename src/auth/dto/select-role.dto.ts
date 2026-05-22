import { IsIn } from 'class-validator';
import { UserRole } from 'prisma/generated/enums';

export class SelectRoleDto {
  @IsIn([UserRole.USER, UserRole.LANDLORD])
  role: UserRole;
}
