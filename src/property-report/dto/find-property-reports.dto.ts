import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FindPropertyReportsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reportTypeId?: number;
}
