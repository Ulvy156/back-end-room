import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAmenityDto {
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
  icon: string;
}
