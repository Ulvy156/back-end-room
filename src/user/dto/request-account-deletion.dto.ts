import { IsNotEmpty, IsString } from 'class-validator';

export class RequestAccountDeletionDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;
}
