import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FindPropertyReportsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  propertyId?: string;
}
