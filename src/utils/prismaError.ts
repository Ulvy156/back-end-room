import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from 'prisma/generated/client';

const logger = new Logger('prismaError');

export function prismaError(err: unknown): never {
  if (err instanceof HttpException) {
    throw err;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = (err.meta?.target as string[])?.join(', ') ?? 'Field';
        throw new HttpException(
          `${fields} already exists`,
          HttpStatus.BAD_REQUEST,
        );
      }

      case 'P2025': {
        const model = (err.meta?.modelName as string) ?? 'Record';
        throw new HttpException(`${model} not found`, HttpStatus.NOT_FOUND);
      }

      case 'P2003': {
        const field = (err.meta?.field_name as string) ?? 'Related record';
        throw new HttpException(`${field} not found`, HttpStatus.BAD_REQUEST);
      }

      case 'P1010':
        throw new HttpException(
          'Access denied to database',
          HttpStatus.FORBIDDEN,
        );
    }
  }

  logger.error(
    err instanceof Error ? err.message : String(err),
    err instanceof Error ? err.stack : undefined,
  );

  throw new HttpException(
    'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
    { cause: err },
  );
}
