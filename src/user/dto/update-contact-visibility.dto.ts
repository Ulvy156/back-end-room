import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateContactVisibilityDto {
  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  showTelegram?: boolean;

  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;
}
