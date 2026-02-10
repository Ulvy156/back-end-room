import {
  IsEnum,
  IsInt,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
// import { ParkingType } from 'prisma/generated/enums';
enum ParkingType {
  MOTO = 'MOTO',
  BICYCLE = 'BICYCLE',
  CAR = 'CAR',
  TUK_TUK = 'TUK_TUK',
}
export class CreateParkingDto {
  @IsEnum(ParkingType)
  type: ParkingType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  slots: number;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
