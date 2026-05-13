import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { UserFavouriteService } from './user-favourite.service';
import { CreateUserFavouriteDto } from './dto/create-user-favourite.dto';
import { Public } from 'src/auth/public.decorator';

@Public()
@Controller('user-favourite')
export class UserFavouriteController {
  constructor(private readonly userFavouriteService: UserFavouriteService) {}

  @Post()
  create(@Body() createUserFavouriteDto: CreateUserFavouriteDto) {
    return this.userFavouriteService.create(createUserFavouriteDto);
  }

  @Get()
  findAll() {
    return this.userFavouriteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userFavouriteService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userFavouriteService.remove(id);
  }

  @Get('/all/user-id/:id')
  getAllFavouriteUserByUserID(@Param('id') id: string) {
    return this.userFavouriteService.getAllFavouriteUserByUserID(id);
  }

  @Get('/user-id/:id')
  getFavouriteUserByUserID(@Param('id') id: string) {
    return this.userFavouriteService.getFavouriteUserByUserID(id);
  }
}
