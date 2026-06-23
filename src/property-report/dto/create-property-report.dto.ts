import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePropertyReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;
}
