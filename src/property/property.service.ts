import { Injectable } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';

@Injectable()
export class PropertyService {
  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    files: Express.Multer.File[],
  ) {
    let uploadedImgKeys: Array<{ key: string; url: string }> = [];
    try {
      const { amenityKeys, ...propertyData } = createPropertyDto;
      uploadedImgKeys = await this.r2Service.uploadMultipleFiles(
        files,
        createPropertyDto.folderType,
      );
      const property = await this.prisma.property.create({
        data: {
          ...propertyData,
          images: {
            create: uploadedImgKeys.map((img) => ({
              imageKey: img.key,
            })),
          },

          propertyAmenities: {
            create: amenityKeys.map((a) => ({
              amenity: {
                connect: { id: a },
              },
            })),
          },
        },
      });

      return property;
    } catch (error) {
      // Cleanup uploaded images if ANYTHING fails
      if (uploadedImgKeys.length) {
        await this.r2Service.deleteMultipleFiles(
          uploadedImgKeys.map((img) => img.key),
        );
      }
      console.log(error);
      
      prismaError(error);
    }
  }

  async findAll() {
    return await this.prisma.property.findMany({
      include: {
        images: true,
        propertyAmenities: true,
        propertyType: true,
      },
    });
  }

  async findOne(id: string) {
    return await this.prisma.property.findUnique({
      where: { id },
    });
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    try {
      const updateProperty = await this.prisma.property.update({
        data: updatePropertyDto,
        where: { id },
      });
      return updateProperty;
    } catch (error) {
      prismaError(error);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} property`;
  }

  async incrementView(id: string) {
    return await this.prisma.property.update({
      data: {
        totalViews: {
          increment: 1,
        },
      },
      where: { id },
    });
  }
}
