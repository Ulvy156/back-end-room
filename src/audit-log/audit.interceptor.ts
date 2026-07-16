import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { QueueService } from '../queue/queue.service';
import { QUEUE_JOBS, WriteAuditLogJob } from '../queue/queue.jobs';
import { SKIP_AUDIT_KEY } from './skip-audit.decorator';

interface RequestWithUser extends Request {
  user?: { id: string };
}

const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly queue: QueueService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const method = request.method;

    if (!AUDITED_METHODS.has(method)) {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const user = request.user;
    const route = request.originalUrl;
    const resourceType = this.extractResourceType(request.path);
    const paramId = request.params?.id;
    const resourceId =
      typeof paramId === 'string' ? paramId : (paramId?.[0] ?? null);
    const ipAddress = request.ip ?? null;
    const userAgent = request.headers['user-agent'] ?? null;

    const queueAudit = (statusCode: number) => {
      void this.queue
        .send<WriteAuditLogJob>(QUEUE_JOBS.WRITE_AUDIT_LOG, {
          userId: user?.id ?? null,
          action: method,
          route,
          resourceType,
          resourceId,
          statusCode,
          ipAddress,
          userAgent,
        })
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to enqueue audit log',
            err instanceof Error ? err.stack : err,
          ),
        );
    };

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        queueAudit(response.statusCode);
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;
        queueAudit(statusCode);
        throw error;
      }),
    );
  }

  private extractResourceType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] ?? 'unknown';
  }
}
