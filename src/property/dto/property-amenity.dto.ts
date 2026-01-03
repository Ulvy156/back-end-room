import { Allow, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AmenityDto {
  @Allow()
  @Type(() => Number)
  @IsInt()
  amenityId: number;
}
