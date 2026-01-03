import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from 'src/auth/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Public()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseInterceptors(FileInterceptor('profile'))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() profile?: Express.Multer.File,
  ) {
    return this.userService.create(createUserDto, profile);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Patch('/lock-user/:id')
  lockUser(@Param('id') id: string) {
    return this.userService.lockUser(id);
  }

  @Patch('/unlock-user/:id')
  unlockUser(@Param('id') id: string) {
    return this.userService.unlockUser(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  @Delete('/delete-profile/:userId')
  deleteProfileByUserId(@Param('userId') userId: string) {
    return this.userService.deleteProfileByUserId(userId);
  }
}
