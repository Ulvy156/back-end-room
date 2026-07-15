import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request } from 'express';
import { QUEUE_JOBS, SendErrorAlertJob } from '../../queue/queue.jobs';
import { QueueService } from '../../queue/queue.service';

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  // In-memory, per-instance dedupe — a burst of the same failure sends one alert, not hundreds.
  private readonly recentAlerts = new Map<string, number>();

  constructor(private readonly queue: QueueService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;

    if (statusCode >= 500) {
      this.alert(exception, host);
    }

    super.catch(exception, host);
  }

  private alert(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request>();
    // Prefer the wrapped `cause` (the real underlying error) over a generic
    // wrapper message like "Internal server error" from prismaError().
    const cause =
      exception instanceof Error
        ? (exception as Error & { cause?: unknown }).cause
        : undefined;
    const realError = cause instanceof Error ? cause : exception;
    const message =
      realError instanceof Error ? realError.message : String(realError);
    const stack = realError instanceof Error ? (realError.stack ?? null) : null;

    const key = `${request.method} ${request.path}:${message}`;
    const now = Date.now();
    const lastAlerted = this.recentAlerts.get(key);
    if (lastAlerted && now - lastAlerted < ALERT_COOLDOWN_MS) {
      return;
    }
    this.recentAlerts.set(key, now);

    void this.queue
      .send<SendErrorAlertJob>(QUEUE_JOBS.SEND_ERROR_ALERT, {
        message,
        stack,
        method: request.method,
        route: request.originalUrl,
        timestamp: new Date().toISOString(),
      })
      .catch((err: unknown) =>
        this.logger.error(
          'Failed to enqueue error alert',
          err instanceof Error ? err.stack : err,
        ),
      );
  }
}
