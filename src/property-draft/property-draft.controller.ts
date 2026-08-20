import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { DynamicImagesInterceptor } from 'src/R2/dynamic-images.interceptor';
import { PropertyDraftService } from './property-draft.service';
import { CreatePropertyDraftDto } from './dto/create-property-draft.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Roles(UserRole.LANDLORD, UserRole.ADMIN)
@Controller('property-draft')
export class PropertyDraftController {
  constructor(private readonly propertyDraftService: PropertyDraftService) {}

  @Throttle({ default: { limit: 16, ttl: 60000 } }) // 16 per min — same R2 cost profile as POST /property
  @Post()
  @UseInterceptors(DynamicImagesInterceptor)
  create(
    @Body() dto: CreatePropertyDraftDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.propertyDraftService.create(dto, files, req.user.id);
  }

  @Get()
  findMyDrafts(@Req() req: AuthenticatedRequest) {
    return this.propertyDraftService.findMyDrafts(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyDraftService.findOne(id, req.user.id, req.user.role);
  }

  @Throttle({ default: { limit: 16, ttl: 60000 } })
  @Patch(':id')
  @UseInterceptors(DynamicImagesInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: CreatePropertyDraftDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.propertyDraftService.update(
      id,
      dto,
      files,
      req.user.id,
      req.user.role,
    );
  }

  @Throttle({ default: { limit: 40, ttl: 60000 } }) // 40 per min — prevents spam delete attempts
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.propertyDraftService.remove(id, req.user.id, req.user.role);
  }

  @Throttle({ default: { limit: 16, ttl: 60000 } })
  @Post(':id/publish')
  publish(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyDraftService.publish(id, req.user.id, req.user.role);
  }
}
