import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  Req,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerDiskOptions } from 'src/R2/multer-disk.config';
import { Public } from 'src/auth/public.decorator';
import { Roles } from 'src/auth/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { SkipAudit } from '../audit-log/skip-audit.decorator';
import { BrowsePropertyDto } from './dto/browser-property.dto';
import { PropertyDetailDTO } from './dto/property-detail.dto';
import { FindPropertiesDto } from './dto/find-properties.dto';
import { UserRole } from 'prisma/generated/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('property')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Throttle({ default: { limit: 2, ttl: 600000 } }) // 2 per 10 min — reflects 3-5 min upload time per property
  @Post()
  @UseInterceptors(FilesInterceptor('files', 20, multerDiskOptions()))
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.propertyService.create(createPropertyDto, files, req.user.id);
  }

  // [ADMIN] All properties — filterable by status, searchable by title, paginated
  @Get()
  findAll(@Query() filter: FindPropertiesDto) {
    return this.propertyService.findAll(filter);
  }

  @Public()
  @Get('/home-page')
  getDataHomePage() {
    return this.propertyService.getDataHomePage();
  }

  @Public()
  @Post('/browse-properties')
  browserProperties(@Body() filter: BrowsePropertyDto) {
    return this.propertyService.browseProperties(filter);
  }

  @Public()
  @Get('/related-properties/:id')
  getRelatedProperties(@Param('id') id: string) {
    return this.propertyService.getRelatedProperties(id);
  }

  @Public()
  @Post('/property-details')
  findOne(@Body() filter: PropertyDetailDTO) {
    return this.propertyService.findOne(filter);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Get('/my-properties')
  getMyProperties(@Req() req: AuthenticatedRequest) {
    return this.propertyService.getMyProperties(req.user.id);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Throttle({ default: { limit: 2, ttl: 600000 } })
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyService.duplicate(id, req.user.id, req.user.role);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Patch('/toggle-publish/:id')
  togglePublish(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyService.togglePublish(id, req.user.id, req.user.role);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Patch('/toggle-availability/:id')
  toggleAvailability(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.propertyService.toggleAvailability(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.propertyService.update(
      id,
      updatePropertyDto,
      req.user.id,
      req.user.role,
    );
  }

  @SkipAudit()
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per min — prevents view count manipulation
  @Patch('/increment-view/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async incrementView(@Param('id') id: string) {
    await this.propertyService.incrementView(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('/set-feature/:id')
  setPropertyToFeature(@Param('id') id: string) {
    return this.propertyService.setPropertyToFeature(id);
  }

  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per min — prevents spam delete attempts
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyService.remove(id, req.user.id, req.user.role);
  }
}
