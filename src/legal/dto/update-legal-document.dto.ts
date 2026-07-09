import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLegalDocumentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
