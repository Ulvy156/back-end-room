import { IsString } from 'class-validator';

export class CreateUserFavouriteDto {
  @IsString()
  userId: string;

  @IsString()
  propertyId: string;
}
