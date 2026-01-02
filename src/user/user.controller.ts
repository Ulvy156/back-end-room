import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FilterUserDTO } from './dto/filter-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post(':id')
  async create(
    @Body() createUserDto: CreateUserDto,
    @Param('id') userId: string,
  ) {
    console.log(createUserDto);

    return await this.userService.create(createUserDto, userId);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('/pagination')
  getPaginationUser(@Query() pagination: PaginationDto) {
    return this.userService.getPaginationUser(pagination);
  }

  @Get('/filter-user')
  filterUserBy(@Body() user: FilterUserDTO) {
    return this.userService.filterUserBy(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Get('/post/:id')
  findUserWithPost(@Param('id') id: string) {
    return this.userService.findUserWithPost(id);
  }

  @Get('/comment/:userId/:postId')
  getUserComment(
    @Param('userId') userId: string,
    @Param('postId') postId: string,
  ) {
    return this.userService.getUserComment(userId, postId);
  }
}
