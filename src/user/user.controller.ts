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
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('profile'))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() profile?: Express.Multer.File,
  ) {
    return this.userService.create(createUserDto, profile);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch('/upadate-profile/:id')
  @UseInterceptors(FileInterceptor('profile'))
  updateProfileByUserId(
    @Param('id') id: string,
    @UploadedFile() profile: Express.Multer.File,
  ) {
    return this.userService.updateProfileByUserId(id, profile);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('/lock-user/:id')
  lockUser(@Param('id') id: string) {
    return this.userService.lockUser(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('/unlock-user/:id')
  unlockUser(@Param('id') id: string) {
    return this.userService.unlockUser(id);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Delete('/delete-profile/:userId')
  deleteProfileByUserId(@Param('userId') userId: string) {
    return this.userService.deleteProfileByUserId(userId);
  }
}
