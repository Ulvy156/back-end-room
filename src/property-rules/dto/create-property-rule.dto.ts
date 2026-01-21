import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePropertyRuleDto {
  @IsNotEmpty()
  @IsString()
  key: string;

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
