import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePropertyTypeDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  nameEn: string;

  @IsNotEmpty()
  @IsString()
  nameKh: string;

  @IsNotEmpty()
  @IsString()
  slug: string;
}
