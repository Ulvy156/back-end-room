import { IsOptional, IsInt, IsString, IsArray } from 'class-validator';

export class BrowsePropertyDto {
  @IsOptional()
  @IsInt()
  minPrice?: number;

  @IsOptional()
  @IsInt()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  locationName?: string;

  @IsOptional()
  @IsInt()
  orderType?: number | null;

  @IsOptional()
  @IsInt()
  location?: number | null;

  @IsOptional()
  @IsInt()
  roomType?: number;

  @IsOptional()
  @IsInt()
  bedroom?: number;

  @IsOptional()
  @IsInt()
  bathroom?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  amenities?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  houseRules?: number[];

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;
}
