import { Injectable } from '@nestjs/common';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';

@Injectable()
export class AmenityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAmenityDto: CreateAmenityDto) {
    try {
      return await this.prisma.amenity.create({
        data: createAmenityDto,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll() {
    return this.prisma.amenity.findMany();
  }

  async findOne(id: number) {
    return await this.prisma.amenity.findUniqueOrThrow({
      where: { id },
    });
  }

  async update(id: number, updateAmenityDto: UpdateAmenityDto) {
    try {
      return await this.prisma.amenity.update({
        data: updateAmenityDto,
        where: { id },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} amenity`;
  }
}
