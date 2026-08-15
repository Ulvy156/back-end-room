import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  // Any JSON type — see CreateSettingDto for why this is @Allow() instead of
  // a type-checked decorator.
  @Allow()
  value?: unknown;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
