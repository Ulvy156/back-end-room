import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from 'prisma/generated/client';

export function prismaError(err: unknown): never {
  // Re-throw HTTP exceptions
  if (err instanceof HttpException) {
    throw err;
  }

  // Handle known Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        throw new HttpException('Duplicate entry', HttpStatus.BAD_REQUEST);

      case 'P2025':
        throw new HttpException('Record not found', HttpStatus.NOT_FOUND);

      case 'P1010':
        throw new HttpException(
          'Access denied to database',
          HttpStatus.FORBIDDEN,
        );
    }
  }

  // FALLBACK — NEVER swallow errors
  throw new HttpException(
    'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
