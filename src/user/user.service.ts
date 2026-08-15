import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyInfoDto } from './dto/update-my-info.dto';
import { UpdateContactVisibilityDto } from './dto/update-contact-visibility.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PhoneNumberType } from 'prisma/generated/enums';
import { hashingPassword } from 'src/utils/hashingPassword';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';
import { SettingsService } from 'src/settings/settings.service';
import { TranslationService } from 'src/i18n/translation.service';

const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  imgUrl: true,
  role: true,
  isVerified: true,
  isLocked: true,
  hasVerifiedBadge: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly appSetting: SettingsService,
    private readonly translation: TranslationService,
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
        data: { ...createUserDto, isVerified: true },
      });
      return user;
    } catch (error) {
      if (createUserDto.img_url) {
        await this.r2Service.deleteSingleFile(createUserDto.img_url);
      }
      prismaError(error);
    }
  }

  async findAll(filter: FindUsersDto) {
    const { role, search, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_PUBLIC_FIELDS,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: USER_PUBLIC_FIELDS,
    });
  }

  async isEmailExist(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
        },
      });
      return !!user;
    } catch (error) {
      prismaError(error);
    }
  }

  async isPhoneExist(phoneNumber: string) {
    try {
      const phone = await this.prisma.phone.findUnique({
        where: { phoneNumber },
        select: {
          id: true,
        },
      });
      return !!phone;
    } catch (error) {
      prismaError(error);
    }
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

  async grantBadge(id: string) {
    try {
      return await this.prisma.user.update({
        data: { hasVerifiedBadge: true },
        where: { id },
        select: USER_PUBLIC_FIELDS,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async revokeBadge(id: string) {
    try {
      return await this.prisma.user.update({
        data: { hasVerifiedBadge: false },
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
        showPhone: true,
        showTelegram: true,
        showEmail: true,
        phones: {
          select: { id: true, phoneNumber: true, type: true },
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

  async updateContactVisibility(
    userId: string,
    dto: UpdateContactVisibilityDto,
  ) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: dto,
        select: { showPhone: true, showTelegram: true, showEmail: true },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async addPhone(userId: string, dto: AddPhoneDto) {
    const limitAddPhoneNumber =
      (await this.appSetting.get<number>('auth', 'limitAddPhoneNumber')) ??
      Infinity;

    const phoneCount = await this.prisma.phone.count({
      where: { userId, type: PhoneNumberType.PHONE },
    });
    if (phoneCount >= limitAddPhoneNumber) {
      throw new BadRequestException(
        this.translation.t('errors.user.phone_limit_exceeded', {
          limit: limitAddPhoneNumber,
        }),
      );
    }

    const existingPhone = await this.prisma.phone.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (existingPhone) {
      throw new BadRequestException(
        this.translation.t('errors.user.phone_already_used'),
      );
    }

    try {
      return await this.prisma.phone.create({
        data: {
          phoneNumber: dto.phoneNumber,
          type: PhoneNumberType.PHONE,
          userId,
        },
        select: { id: true, phoneNumber: true, type: true, createdAt: true },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async removePhone(userId: string, phoneId: number) {
    const phone = await this.prisma.phone.findUnique({
      where: { id: phoneId },
    });
    if (!phone || phone.userId !== userId) {
      throw new NotFoundException('Phone not found');
    }
    await this.prisma.phone.delete({ where: { id: phoneId } });
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
