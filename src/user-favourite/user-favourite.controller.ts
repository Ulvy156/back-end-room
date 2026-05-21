import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { UserFavouriteService } from './user-favourite.service';
import { CreateUserFavouriteDto } from './dto/create-user-favourite.dto';
import { UserRole } from 'prisma/generated/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('user-favourite')
export class UserFavouriteController {
  constructor(private readonly userFavouriteService: UserFavouriteService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 per min — prevents favourite spam
  @Post()
  create(
    @Body() createUserFavouriteDto: CreateUserFavouriteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userFavouriteService.create(
      createUserFavouriteDto,
      req.user.id,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userFavouriteService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.userFavouriteService.remove(id, req.user.id, req.user.role);
  }

  @Get('/all/user-id/:id')
  getAllFavouriteUserByUserID(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userFavouriteService.getAllFavouriteUserByUserID(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Get('/user-id/:id')
  getFavouriteUserByUserID(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userFavouriteService.getFavouriteUserByUserID(
      id,
      req.user.id,
      req.user.role,
    );
  }
}
