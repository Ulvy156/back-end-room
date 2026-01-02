import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';

export function prismaError(err: any) {
  if (err instanceof HttpException) {
    throw new HttpException(err.message, err.getStatus());
  }

  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;

  switch (err.code) {
    case 'P2002':
      throw new HttpException('Duplicate entry', HttpStatus.BAD_REQUEST);
    case 'P2025':
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    case 'P1010':
      throw new HttpException(
        'Access denied to database',
        HttpStatus.NOT_FOUND,
      );
  }
}
