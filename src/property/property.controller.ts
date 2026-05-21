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
} from '@nestjs/common';
import { Request } from 'express';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/auth/public.decorator';
import { Roles } from 'src/auth/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { BrowsePropertyDto } from './dto/browser-property.dto';
import { PropertyDetailDTO } from './dto/property-detail.dto';
import { UserRole } from 'prisma/generated/enums';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('property')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Throttle({ default: { limit: 5, ttl: 600000 } }) // 5 per 10 min — prevents fake listing spam
  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.propertyService.create(createPropertyDto, files);
  }

  @Get()
  findAll() {
    return this.propertyService.findAll();
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

  @Get('/my-properties')
  getMyProperties(@Req() req: AuthenticatedRequest) {
    return this.propertyService.getMyProperties(req.user.id);
  }

  @Patch('/toggle-publish/:id')
  togglePublish(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyService.togglePublish(id, req.user.id, req.user.role);
  }

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

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per min — prevents spam delete attempts
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.propertyService.remove(id, req.user.id, req.user.role);
  }
}
