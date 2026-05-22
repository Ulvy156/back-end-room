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
  Req,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyInfoDto } from './dto/update-my-info.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Admin ───────────────────────────────────────────────────────────────────

  // [ADMIN] Create a user account manually (bypasses the registration + OTP flow)
  @Roles(UserRole.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('profile'))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() profile?: Express.Multer.File,
  ) {
    return this.userService.create(createUserDto, profile);
  }

  // [ADMIN] List users — filter by role, search by name/email, paginated
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() filter: FindUsersDto) {
    return this.userService.findAll(filter);
  }

  // [ADMIN] Get any user by ID
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  // [ADMIN] Update any user's data (name, email, role, etc.)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  // [ADMIN] Lock a user account — prevents login
  @Roles(UserRole.ADMIN)
  @Patch('/lock-user/:id')
  lockUser(@Param('id') id: string) {
    return this.userService.lockUser(id);
  }

  // [ADMIN] Unlock a previously locked user account
  @Roles(UserRole.ADMIN)
  @Patch('/unlock-user/:id')
  unlockUser(@Param('id') id: string) {
    return this.userService.unlockUser(id);
  }

  // [ADMIN] Permanently delete a user account
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  // ─── Self-service ─────────────────────────────────────────────────────────────

  // [USER] Get own full profile including linked phone numbers
  @Get('/me')
  getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.userService.getMyProfile(req.user.id);
  }

  // [USER] Update own display name — email/password/role have their own dedicated flows
  @Patch('/me')
  updateMyInfo(@Body() dto: UpdateMyInfoDto, @Req() req: AuthenticatedRequest) {
    return this.userService.updateMyInfo(req.user.id, dto);
  }

  // [USER] Replace own profile avatar — old image is deleted from R2 after successful upload
  @Patch('/me/profile-image')
  @UseInterceptors(FileInterceptor('profile'))
  updateProfileImage(
    @UploadedFile() profile: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userService.updateProfileByUserId(req.user.id, profile);
  }

  // [USER] Remove own profile avatar
  @Delete('/me/profile-image')
  deleteProfileImage(@Req() req: AuthenticatedRequest) {
    return this.userService.deleteProfileByUserId(req.user.id);
  }
}
