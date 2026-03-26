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
} from '@nestjs/common';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/auth/public.decorator';
import { BrowsePropertyDto } from './dto/browser-property.dto';
import { PropertyDetailDTO } from './dto/property-detail.dto';

@Public()
@Controller('property')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

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

  @Get('/home-page')
  getDataHomePage() {
    return this.propertyService.getDataHomePage();
  }

  @Post('/browse-properties')
  browserProperties(@Body() filter: BrowsePropertyDto) {
    return this.propertyService.browseProperties(filter);
  }

  @Get('/related-properties/:id')
  getRelatedProperties(@Param('id') id: string) {
    return this.propertyService.getRelatedProperties(id);
  }

  @Post('/property-details')
  findOne(@Body() filter: PropertyDetailDTO) {
    return this.propertyService.findOne(filter);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertyService.update(id, updatePropertyDto);
  }

  @Patch('/increment-view/:id')
  incrementView(@Param('id') id: string) {
    return this.propertyService.incrementView(id);
  }

  @Patch('/set-feature/:id')
  setPropertyToFeature(@Param('id') id: string) {
    return this.propertyService.setPropertyToFeature(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyService.remove(+id);
  }
}
