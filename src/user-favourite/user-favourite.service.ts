import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserFavouriteDto } from './dto/create-user-favourite.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { UserRole } from 'prisma/generated/enums';

@Injectable()
export class UserFavouriteService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwner(
    favouriteId: string,
    requesterId: string,
    role: UserRole,
  ) {
    const favourite = await this.prisma.favorite.findUnique({
      where: { id: favouriteId },
    });
    if (!favourite) throw new NotFoundException('Favourite not found');
    if (favourite.userId !== requesterId && role !== UserRole.ADMIN)
      throw new ForbiddenException(
        'You do not have permission to perform this action',
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
        'You do not have permission to perform this action',
      );
    try {
      return await this.prisma.favorite.findMany({ where: { userId } });
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
        'You do not have permission to perform this action',
      );
    try {
      return await this.prisma.favorite.findFirstOrThrow({ where: { userId } });
    } catch (error) {
      prismaError(error);
    }
  }
}
