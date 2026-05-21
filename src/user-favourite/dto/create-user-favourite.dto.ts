import { IsString } from 'class-validator';

export class CreateUserFavouriteDto {
  @IsString()
  propertyId: string;
}
