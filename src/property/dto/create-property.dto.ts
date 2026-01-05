import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

export class CreatePropertyDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsNumber()
  districtId: number;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsUrl()
  @Matches(/^https?:\/\/(www\.)?google\.[a-z.]+\/maps\/.+$/, {
    message: 'location_url must be a valid Google Maps URL',
  })
  locationUrl: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deposit?: number;

  @Type(() => Number)
  @IsInt()
  propertyTypeId: number;

  @Type(() => Number)
  @IsNumber()
  sizeSqm: number;

  @IsOptional()
  @IsBoolean()
  furnished: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  folderType?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  amenityKeys: number[];
}
