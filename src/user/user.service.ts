import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyInfoDto } from './dto/update-my-info.dto';
import { UpdateContactVisibilityDto } from './dto/update-contact-visibility.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PhoneNumberType, UserRole } from 'prisma/generated/enums';
import { hashingPassword } from 'src/utils/hashingPassword';
import { prismaError } from 'src/utils/prismaError';
import { R2Service } from 'src/R2/r2.service';
import { SettingsService } from 'src/settings/settings.service';
import { TranslationService } from 'src/i18n/translation.service';
import { PropertyService } from 'src/property/property.service';
import { getDraftImages } from 'src/property-draft/draft-image.util';

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

// Account-management fields, not general public-profile data — only ever
// selected for the caller's own record (getMyProfile, deletion-request
// responses), never for admin listing/detail of another user.
const USER_SELF_FIELDS = {
  ...USER_PUBLIC_FIELDS,
  showPhone: true,
  showTelegram: true,
  showEmail: true,
  hasPassword: true,
  deletionRequestedAt: true,
  deletionScheduledFor: true,
} as const;

// What an admin needs to triage a pending deletion request — deliberately
// separate from USER_PUBLIC_FIELDS (kept free of deletion state) rather than
// adding these fields there.
const DELETION_REQUEST_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  imgUrl: true,
  createdAt: true,
  deletionRequestedAt: true,
  deletionScheduledFor: true,
} as const;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
    private readonly appSetting: SettingsService,
    private readonly translation: TranslationService,
    private readonly propertyService: PropertyService,
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

  // [ADMIN] Users with a pending self-service deletion request, oldest
  // first — the review queue that feeds approveAccountDeletion(:id).
  async findDeletionRequests(filter: FindUsersDto) {
    const { role, search, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      deletionRequestedAt: { not: null },
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
        select: DELETION_REQUEST_FIELDS,
        skip,
        take: limit,
        orderBy: { deletionRequestedAt: 'asc' },
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
        ...USER_SELF_FIELDS,
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

  // [USER] Request account deletion — flags the account and starts the
  // grace period; a landlord's unlocked properties get hidden immediately.
  async requestAccountDeletion(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.hasPassword) {
      throw new BadRequestException(
        this.translation.t('errors.user.password_required_for_deletion'),
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException(
        this.translation.t('errors.auth.wrong_current_password'),
      );
    }

    const deletionRequestedAt = new Date();
    const deletionScheduledFor = new Date(
      deletionRequestedAt.getTime() +
        this.ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Conditional update instead of check-then-write — makes the
        // duplicate-request guard race-safe: if two requests land
        // concurrently, only one can match and update a row.
        const result = await tx.user.updateMany({
          where: { id: userId, deletionRequestedAt: null },
          data: { deletionRequestedAt, deletionScheduledFor },
        });
        if (result.count === 0) {
          throw new BadRequestException(
            this.translation.t('errors.user.deletion_already_requested'),
          );
        }
        if (user.role === UserRole.LANDLORD) {
          await this.propertyService.lockPropertiesByOwner(userId, tx);
        }
        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: USER_SELF_FIELDS,
        });
      });

      if (user.role === UserRole.LANDLORD) {
        await this.propertyService.clearCacheHomePage();
      }

      return {
        ...updated,
        message: this.translation.t('messages.user.deletion_requested'),
      };
    } catch (error) {
      prismaError(error);
    }
  }

  // [USER] Cancel a pending deletion request — only unlocks properties this
  // request itself locked, never touches admin-locked ones.
  async cancelAccountDeletion(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.deletionRequestedAt) {
      throw new BadRequestException(
        this.translation.t('errors.user.no_deletion_pending'),
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { deletionRequestedAt: null, deletionScheduledFor: null },
        });
        if (user.role === UserRole.LANDLORD) {
          await this.propertyService.unlockPropertiesByOwner(userId, tx);
        }
      });

      if (user.role === UserRole.LANDLORD) {
        await this.propertyService.clearCacheHomePage();
      }
    } catch (error) {
      prismaError(error);
    }
  }

  // [ADMIN] Approve a pending deletion request — permanently deletes the
  // account and all owned data immediately, regardless of grace period.
  async approveAccountDeletion(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.translation.t('errors.user.not_found'));
    }
    if (!user.deletionRequestedAt) {
      throw new BadRequestException(
        this.translation.t('errors.user.no_deletion_pending'),
      );
    }

    // Collect every R2 key this user owns BEFORE anything is deleted, so
    // cleanup can run only after the DB transaction has actually committed.
    const [propertyImages, drafts] = await Promise.all([
      this.prisma.propertyImage.findMany({
        where: { property: { userId } },
        select: { imageKey: true },
      }),
      this.prisma.propertyDraft.findMany({
        where: { userId },
        select: { images: true },
      }),
    ]);
    const draftImageKeys = drafts
      .flatMap((d) => getDraftImages(d))
      .map((img) => img.key);
    const imageKeysToDelete = [
      ...propertyImages.map((img) => img.imageKey),
      ...draftImageKeys,
      ...(user.imgUrl ? [user.imgUrl] : []),
    ];

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.property.deleteMany({ where: { userId } });
        await tx.propertyDraft.deleteMany({ where: { userId } });

        // Conditional final delete, guarding against a concurrent
        // cancelAccountDeletion() winning the race. If it matches nothing,
        // the throw rolls back the whole transaction, including the
        // property/draft deletes just above.
        const result = await tx.user.deleteMany({
          where: { id: userId, deletionRequestedAt: { not: null } },
        });
        if (result.count === 0) {
          throw new ConflictException(
            this.translation.t('errors.user.no_deletion_pending'),
          );
        }
      });
    } catch (error) {
      prismaError(error);
    }

    if (user.role === UserRole.LANDLORD) {
      await this.propertyService.clearCacheHomePage();
    }

    if (imageKeysToDelete.length) {
      try {
        await this.r2Service.deleteMultipleFiles(imageKeysToDelete);
      } catch (error) {
        // DB deletion already committed — a recoverable cleanup gap, not
        // something to roll back or fail the request over.
        this.logger.error(
          `Failed to clean up R2 files for deleted user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { message: this.translation.t('messages.admin.deletion_approved') };
  }
}
