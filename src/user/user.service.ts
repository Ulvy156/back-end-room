import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { prismaError } from 'src/utils/prismaError';
import { hashingPassword } from 'src/utils/hashingPassword';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { FilterUserDTO } from './dto/filter-user.dto';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, userId: string) {
    try {
      const findUser = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          role: true,
        },
      });

      if (findUser?.role.name !== 'ADMIN') {
        throw new HttpException('Unauthorization', HttpStatus.UNAUTHORIZED);
      }
      const password = await hashingPassword(createUserDto.psw);
      createUserDto.psw = password;

      const user = await this.prisma.user.create({
        data: createUserDto,
      });
      return user;
    } catch (error) {
      prismaError(error);
      throw error;
    }
  }

  async findAll() {
    return await this.prisma.user.findMany({
      include: {
        role: true,
      },
    });
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: {
          id,
        },
        include: {
          role: true,
        },
      });
      return user;
    } catch (error) {
      prismaError(error);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
      return updatedUser;
    } catch (error) {
      prismaError(error);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return {
        message: `User with id ${id} has been removed`,
        status: HttpStatus.OK,
      };
    } catch (error) {
      prismaError(error);
    }
  }

  async findUserWithPost(userID: string) {
    try {
      const userWithPost = this.prisma.user.findUniqueOrThrow({
        where: { id: userID },
        include: {
          posts: true,
        },
      });
      return userWithPost;
    } catch (error) {
      prismaError(error);
    }
  }

  async getUserComment(userId: string, postId: string) {
    try {
      const comments = await this.prisma.comment.findMany({
        where: { postId: postId },
        select: {
          id: true,
          message: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      });
      return comments;
    } catch (error) {
      prismaError(error);
    }
  }

  async getPaginationUser(pagination: PaginationDto) {
    try {
      const skips = (pagination.page - 1) * pagination.limit;

      const [users, total] = await Promise.all([
        // get user
        this.prisma.user.findMany({
          skip: skips,
          take: pagination.limit,
          orderBy: {
            name: { sort: 'asc' },
          },
        }),
        // count all users
        this.prisma.user.count(),
      ]);
      return { users, total, totalPages: Math.ceil(total / pagination.limit) };
    } catch (error) {
      prismaError(error);
    }
  }

  async filterUserBy(filteUserDTO: FilterUserDTO) {
    try {
      const andCondition: Prisma.UserWhereInput[] = [];

      if (filteUserDTO.email) {
        andCondition.push({
          email: { contains: filteUserDTO.email, mode: 'insensitive' },
        });
      }

      if (filteUserDTO.name) {
        andCondition.push({
          name: { contains: filteUserDTO.name, mode: 'insensitive' },
        });
      }

      const users = await this.prisma.user.findMany({
        where: {
          AND: andCondition,
        },
      });
      return users;
    } catch (error) {
      prismaError(error);
    }
  }
}
