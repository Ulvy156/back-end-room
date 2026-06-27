import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CreateParkingDto } from './create-parking.dto';

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
  monthly_price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deposit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bedroom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bathroom?: number;

  @Type(() => Number)
  @IsInt()
  propertyTypeId: number;

  @Type(() => Number)
  @IsNumber()
  sizeSqm: number;

  @Type(() => Number)
  @IsNumber()
  floor: number;

  @Type(() => Number)
  @IsNumber()
  totalFloors: number;

  @IsOptional()
  @IsBoolean()
  furnished: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished: boolean;

  @IsOptional()
  @IsDate()
  availableFrom: Date;

  @IsOptional()
  @IsNumber()
  minimumStayLength: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}\s?(AM|PM|am|pm)?$/, {
    message: 'openTime must be in HH:mm or HH:mm AM/PM format',
  })
  openTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}\s?(AM|PM|am|pm)?$/, {
    message: 'closeTime must be in HH:mm or HH:mm AM/PM format',
  })
  closeTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

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

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  ruleKeys?: number[];

  @IsOptional()
  @Transform(
    ({ value }) => {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) return [];
          return plainToInstance(CreateParkingDto, parsed);
        } catch {
          return [];
        }
      }
      return value;
    },
    { toClassOnly: true },
  )
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParkingDto)
  parkings?: CreateParkingDto[];
}
