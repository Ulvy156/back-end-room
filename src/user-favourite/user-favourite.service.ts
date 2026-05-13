import { Injectable } from '@nestjs/common';
import { CreateUserFavouriteDto } from './dto/create-user-favourite.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';

@Injectable()
export class UserFavouriteService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUserFavouriteDto: CreateUserFavouriteDto) {
    try {
      return await this.prisma.favorite.create({
        data: createUserFavouriteDto,
      });
    } catch (error) {
      prismaError(error);
    }
  }

  findAll() {
    return `This action returns all userFavourite`;
  }

  async findOne(id: string) {
    try {
      return await this.prisma.favorite.findFirstOrThrow({
        where: { id },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.favorite.delete({
        where: { id },
      });
    } catch (error) {
      prismaError(error);
    }
  }

  // get all user's favourite which belong to user
  async getAllFavouriteUserByUserID(id: string) {
    try {
      return await this.prisma.favorite.findMany({
        where: { userId: id },
      });
    } catch (error) {
      prismaError(error);
    }
  }
  // get one user's favourite which belong to user
  async getFavouriteUserByUserID(id: string) {
    try {
      return await this.prisma.favorite.findFirstOrThrow({
        where: { userId: id },
      });
    } catch (error) {
      prismaError(error);
    }
  }
}
