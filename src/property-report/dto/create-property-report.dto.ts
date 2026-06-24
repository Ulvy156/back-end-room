import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyReportDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  reportTypeId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;
}
