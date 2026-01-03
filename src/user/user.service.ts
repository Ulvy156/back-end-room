import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { hashingPassword } from 'src/utils/hashingPassword';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
  ) {}

  async create(createUserDto: CreateUserDto, profile?: Express.Multer.File) {
    try {
      // upload only if user has profile pf
      if (profile) {
        const { key } = await this.r2Service.uploadSingleFile(
          profile,
          'profile',
        );
        createUserDto.img_url = key;
      }
      createUserDto.password = await hashingPassword(createUserDto.password);
      const user = await this.prisma.user.create({
        data: createUserDto,
      });

      return user;
    } catch (error) {
      if (createUserDto.img_url) {
        await this.r2Service.deleteSingleFile(createUserDto.img_url);
      }
      prismaError(error);
    }
  }

  async deleteProfileByUserId(userId: string) {
    try {
      // Fetch user
      const user = await this.findOne(userId);

      // Delete file first (if exists)
      if (user.img_url) {
        await this.r2Service.deleteSingleFile(user.img_url);
      }

      // Update DB
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          img_url: null,
        },
      });
      return updatedUser;
    } catch (error) {
      prismaError(error);
    }
  }

  async findAll() {
    return await this.prisma.user.findMany();
  }

  async findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
