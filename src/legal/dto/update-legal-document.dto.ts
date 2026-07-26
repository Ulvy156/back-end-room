import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLegalDocumentDto {
  @IsString()
  @IsNotEmpty()
  contentEn: string;

  @IsString()
  @IsNotEmpty()
  contentKh: string;
}
