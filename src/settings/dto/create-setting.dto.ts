import {
  Allow,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSettingDto {
  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsString()
  key: string;

  // Any JSON type (string/number/boolean/array/object/null) — kept out of
  // class-validator's type checking; SettingsService validates it against
  // SETTING_DEFINITIONS. @Allow() keeps it from being stripped by the
  // global ValidationPipe's whitelist.
  @Allow()
  value: unknown;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
