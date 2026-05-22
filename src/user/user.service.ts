import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyInfoDto } from './dto/update-my-info.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { hashingPassword } from 'src/utils/hashingPassword';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';

const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  imgUrl: true,
  role: true,
  isVerified: true,
  isLocked: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
  ) {}

  // ─── Admin ───────────────────────────────────────────────────────────────────

  async create(createUserDto: CreateUserDto, profile?: Express.Multer.File) {
    try {
      if (profile) {
        const { key } = await this.r2Service.uploadSingleFile(
          profile,
          'profile',
        );
        createUserDto.img_url = key;
      }
      createUserDto.password = await hashingPassword(createUserDto.password);
      const { password: _, ...user } = await this.prisma.user.create({
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

  async findAll() {
    return await this.prisma.user.findMany({ select: USER_PUBLIC_FIELDS });
  }

  async findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: USER_PUBLIC_FIELDS,
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const { password: _, ...user } = await this.prisma.user.update({
        data: updateUserDto,
        where: { id },
      });
      return user;
    } catch (error) {
      prismaError(error);
    }
  }

  async lockUser(id: string) {
    try {
      return await this.prisma.user.update({
        data: { isLocked: true },
        where: { id },
        select: USER_PUBLIC_FIELDS,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async unlockUser(id: string) {
    try {
      return await this.prisma.user.update({
        data: { isLocked: false },
        where: { id },
        select: USER_PUBLIC_FIELDS,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return await this.prisma.user.delete({ where: { id } });
  }

  // ─── Self-service ─────────────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    return await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        ...USER_PUBLIC_FIELDS,
        phones: {
          select: { phoneNumber: true, type: true },
        },
      },
    });
  }

  async updateMyInfo(userId: string, dto: UpdateMyInfoDto) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { name: dto.name },
        select: USER_PUBLIC_FIELDS,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async updateProfileByUserId(userId: string, profile: Express.Multer.File) {
    let newImageKey: string | null = null;
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      const { key } = await this.r2Service.uploadSingleFile(profile, 'profile');
      newImageKey = key;

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { imgUrl: newImageKey },
        select: USER_PUBLIC_FIELDS,
      });

      if (user.imgUrl) {
        await this.r2Service.deleteSingleFile(user.imgUrl);
      }

      return updatedUser;
    } catch (error) {
      if (newImageKey) {
        await this.r2Service.deleteSingleFile(newImageKey);
      }
      prismaError(error);
    }
  }

  async deleteProfileByUserId(userId: string) {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      if (user.imgUrl) {
        await this.r2Service.deleteSingleFile(user.imgUrl);
      }

      return this.prisma.user.update({
        where: { id: userId },
        data: { imgUrl: null },
        select: USER_PUBLIC_FIELDS,
      });
    } catch (error) {
      prismaError(error);
    }
  }
}
