import { IsOptional, IsString } from 'class-validator';

export class FilterUserDTO {
  @IsOptional()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  name: string;
}
