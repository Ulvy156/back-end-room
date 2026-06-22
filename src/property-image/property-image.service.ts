import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { R2Service } from 'src/R2/r2.service';
import { TranslationService } from 'src/i18n/translation.service';
import { UserRole } from 'prisma/generated/enums';
import { prismaError } from 'src/utils/prismaError';

@Injectable()
export class PropertyImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly translation: TranslationService,
  ) {}

  // Fetches the image and verifies the requester owns the parent property.
  private async assertImageOwner(
    imageId: string,
    requesterId: string,
    role: UserRole,
  ) {
    const image = await this.prisma.propertyImage.findUnique({
      where: { id: imageId },
      include: { property: { select: { userId: true } } },
    });
    if (!image)
      throw new NotFoundException(
        this.translation.t('errors.property_image.not_found'),
      );
    if (image.property.userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.property_image.forbidden'),
      );
    return image;
  }

  // [LANDLORD | ADMIN] Upload a new image to an existing property
  async upload(
    propertyId: string,
    file: Express.Multer.File,
    requesterId: string,
    role: UserRole,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property)
      throw new NotFoundException(
        this.translation.t('errors.property.not_found'),
      );
    if (property.userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.property_image.forbidden'),
      );

    try {
      const { key } = await this.r2Service.uploadSingleFile(file, 'properties');
      return this.prisma.propertyImage.create({
        data: { propertyId, imageKey: key, isCover: false },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  // [LANDLORD | ADMIN] Delete an image — removes from R2 and DB
  async remove(imageId: string, requesterId: string, role: UserRole) {
    const image = await this.assertImageOwner(imageId, requesterId, role);
    try {
      await this.r2Service.deleteSingleFile(image.imageKey);
      await this.prisma.propertyImage.delete({ where: { id: imageId } });
    } catch (error) {
      prismaError(error);
    }
  }

  // [LANDLORD | ADMIN] Set an image as the cover — unsets all others for the same property
  async setCover(imageId: string, requesterId: string, role: UserRole) {
    const image = await this.assertImageOwner(imageId, requesterId, role);
    try {
      await this.prisma.$transaction([
        this.prisma.propertyImage.updateMany({
          where: { propertyId: image.propertyId },
          data: { isCover: false },
        }),
        this.prisma.propertyImage.update({
          where: { id: imageId },
          data: { isCover: true },
        }),
      ]);
    } catch (error) {
      prismaError(error);
    }
  }
}
