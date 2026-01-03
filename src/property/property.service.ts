import { Injectable } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PropertyService {
  constructor(private prisma: PrismaService) {}

  create(createPropertyDto: CreatePropertyDto) {
    return 'This action adds a new property';
  }

  async findAll() {
    return await this.prisma.property.findMany();
  }

  async findOne(id: string) {
    return await this.prisma.property.findUnique({
      where: { id },
    });
  }

  update(id: number, updatePropertyDto: UpdatePropertyDto) {
    return `This action updates a #${id} property`;
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
