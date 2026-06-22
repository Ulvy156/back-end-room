import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { PropertyImageService } from './property-image.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Roles(UserRole.LANDLORD, UserRole.ADMIN)
@Controller('property-image')
export class PropertyImageController {
  constructor(private readonly propertyImageService: PropertyImageService) {}

  // [LANDLORD | ADMIN] Upload a new image to an existing property
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per min — image uploads are fast but still rate-limited
  @Post(':propertyId')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('propertyId') propertyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.propertyImageService.upload(
      propertyId,
      file,
      req.user.id,
      req.user.role,
    );
  }

  // [LANDLORD | ADMIN] Delete an image by its ID
  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('imageId') imageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.propertyImageService.remove(imageId, req.user.id, req.user.role);
  }

  // [LANDLORD | ADMIN] Set an image as the cover photo — unsets all other covers for the property
  @Patch(':imageId/set-cover')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setCover(
    @Param('imageId') imageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.propertyImageService.setCover(
      imageId,
      req.user.id,
      req.user.role,
    );
  }
}
