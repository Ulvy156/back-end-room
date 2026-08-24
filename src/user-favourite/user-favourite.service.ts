import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserFavouriteDto } from './dto/create-user-favourite.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { UserRole } from 'prisma/generated/enums';
import { TranslationService } from 'src/i18n/translation.service';

@Injectable()
export class UserFavouriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
  ) {}

  private async assertOwner(
    favouriteId: string,
    requesterId: string,
    role: UserRole,
  ) {
    const favourite = await this.prisma.favorite.findUnique({
      where: { id: favouriteId },
    });
    if (!favourite)
      throw new NotFoundException(
        this.translation.t('errors.favourite.not_found'),
      );
    if (favourite.userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.favourite.forbidden'),
      );
    return favourite;
  }

  async create(
    createUserFavouriteDto: CreateUserFavouriteDto,
    requesterId: string,
  ) {
    try {
      return await this.prisma.favorite.create({
        data: { ...createUserFavouriteDto, userId: requesterId },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async findOne(id: string) {
    try {
      return await this.prisma.favorite.findFirstOrThrow({ where: { id } });
    } catch (error) {
      prismaError(error);
    }
  }

  async remove(id: string, requesterId: string, role: UserRole) {
    await this.assertOwner(id, requesterId, role);
    try {
      return await this.prisma.favorite.delete({ where: { id } });
    } catch (error) {
      prismaError(error);
    }
  }

  async getAllFavouriteUserByUserID(
    userId: string,
    requesterId: string,
    role: UserRole,
  ) {
    if (userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.favourite.forbidden'),
      );
    try {
      return await this.prisma.favorite.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          property: {
            select: {
              id: true,
              title: true,
              monthly_price: true,
              sizeSqm: true,
              sizeWidthM: true,
              sizeLengthM: true,
              totalViews: true,
              bedroom: true,
              bathroom: true,
              isAvailable: true,
              deposit: true,
              availableFrom: true,
              images: {
                take: 1,
                where: { isCover: true },
                select: { imageKey: true },
              },
              district: {
                select: {
                  nameEn: true,
                  nameKh: true,
                  province: { select: { nameEn: true, nameKh: true } },
                },
              },
              propertyType: {
                select: { nameEn: true, nameKh: true, icon: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async getFavouriteUserByUserID(
    userId: string,
    requesterId: string,
    role: UserRole,
  ) {
    if (userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        this.translation.t('errors.favourite.forbidden'),
      );
    try {
      return await this.prisma.favorite.findFirstOrThrow({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          property: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      prismaError(error);
    }
  }
}
