import { Injectable } from '@nestjs/common';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';

@Injectable()
export class PropertyTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPropertyTypeDto: CreatePropertyTypeDto) {
    try {
      return await this.prisma.propertyType.create({
        data: createPropertyTypeDto,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll() {
    return await this.prisma.propertyType.findMany();
  }

  async findOne(id: number) {
    return this.prisma.propertyType.findUniqueOrThrow({
      where: { id },
    });
  }

  async update(id: number, updatePropertyTypeDto: UpdatePropertyTypeDto) {
    try {
      return await this.prisma.propertyType.update({
        data: updatePropertyTypeDto,
        where: { id },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} propertyType`;
  }
}
