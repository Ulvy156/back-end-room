import { PartialType } from '@nestjs/mapped-types';
import { CreateUserFavouriteDto } from './create-user-favourite.dto';

export class UpdateUserFavouriteDto extends PartialType(
  CreateUserFavouriteDto,
) {}
