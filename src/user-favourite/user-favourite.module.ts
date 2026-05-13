import { Module } from '@nestjs/common';
import { UserFavouriteService } from './user-favourite.service';
import { UserFavouriteController } from './user-favourite.controller';

@Module({
  controllers: [UserFavouriteController],
  providers: [UserFavouriteService],
})
export class UserFavouriteModule {}
