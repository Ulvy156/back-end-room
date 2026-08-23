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
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyInfoDto } from './dto/update-my-info.dto';
import { UpdateContactVisibilityDto } from './dto/update-contact-visibility.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { IsEmailExistDto } from './dto/is-email-exist.dto';
import { IsPhoneExistDto } from './dto/is-phone-exist.dto';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerDiskOptions } from 'src/R2/multer-disk.config';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from 'prisma/generated/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Self-service (must be above :id routes to avoid "me" matching as a param) ─

  @Get('/me')
  getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.userService.getMyProfile(req.user.id);
  }

  @Patch('/me')
  updateMyInfo(@Body() dto: UpdateMyInfoDto, @Req() req: AuthenticatedRequest) {
    return this.userService.updateMyInfo(req.user.id, dto);
  }

  @Patch('/me/contact-visibility')
  updateContactVisibility(
    @Body() dto: UpdateContactVisibilityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userService.updateContactVisibility(req.user.id, dto);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Post('/me/phones')
  addPhone(@Body() dto: AddPhoneDto, @Req() req: AuthenticatedRequest) {
    return this.userService.addPhone(req.user.id, dto);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Delete('/me/phones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhone(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userService.removePhone(req.user.id, id);
  }

  @Patch('/me/profile-image')
  @UseInterceptors(FileInterceptor('profile', multerDiskOptions()))
  updateProfileImage(
    @UploadedFile() profile: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userService.updateProfileByUserId(req.user.id, profile);
  }

  @Delete('/me/profile-image')
  deleteProfileImage(@Req() req: AuthenticatedRequest) {
    return this.userService.deleteProfileByUserId(req.user.id);
  }

  // [USER] Request account deletion — requires current password, starts the grace period
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per min, matches change-password
  @Patch('/me/deletion-request')
  requestAccountDeletion(
    @Body() dto: RequestAccountDeletionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userService.requestAccountDeletion(
      req.user.id,
      dto.currentPassword,
    );
  }

  // [USER] Cancel a pending deletion request
  @Delete('/me/deletion-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelAccountDeletion(@Req() req: AuthenticatedRequest) {
    return this.userService.cancelAccountDeletion(req.user.id);
  }

  @Public()
  @Get('/is-email-exist')
  isEmailExist(@Query() { email }: IsEmailExistDto) {
    return this.userService.isEmailExist(email);
  }

  @Public()
  @Get('/is-phone-exist')
  isPhoneExist(@Query() { phoneNumber }: IsPhoneExistDto) {
    return this.userService.isPhoneExist(phoneNumber);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('profile', multerDiskOptions()))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() profile?: Express.Multer.File,
  ) {
    return this.userService.create(createUserDto, profile);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() filter: FindUsersDto) {
    return this.userService.findAll(filter);
  }

  // [ADMIN] Review queue for approveAccountDeletion(:id) — must stay above
  // ':id' below, or "deletion-requests" would be parsed as an id param.
  @Roles(UserRole.ADMIN)
  @Get('/deletion-requests')
  findDeletionRequests(@Query() filter: FindUsersDto) {
    return this.userService.findDeletionRequests(filter);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
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
  @Patch('/grant-badge/:id')
  grantBadge(@Param('id') id: string) {
    return this.userService.grantBadge(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('/revoke-badge/:id')
  revokeBadge(@Param('id') id: string) {
    return this.userService.revokeBadge(id);
  }

  // [ADMIN] Approve a pending deletion request — permanently deletes the
  // account and all owned data immediately, regardless of grace period.
  @Roles(UserRole.ADMIN)
  @Patch('/approve-deletion/:id')
  approveAccountDeletion(@Param('id') id: string) {
    return this.userService.approveAccountDeletion(id);
  }

  // [ADMIN] Force-delete a user immediately — cascades to owned properties,
  // drafts, and R2 images, without requiring a pending deletion request.
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
