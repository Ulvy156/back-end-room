import { Logger } from 'nestjs-pino';
import { QueueService } from '../queue/queue.service';
import { QUEUE_JOBS, SendErrorAlertJob } from '../queue/queue.jobs';

// Node terminates the process on uncaughtException/unhandledRejection by default —
// alert the admin, then exit so the process manager can restart on a clean state.
export function registerProcessCrashHandlers(
  logger: Logger,
  queue: QueueService,
) {
  const handleFatal = (label: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    logger.error(`${label}: ${message}`, stack ?? undefined);

    void queue
      .send<SendErrorAlertJob>(QUEUE_JOBS.SEND_ERROR_ALERT, {
        message: `${label}: ${message}`,
        stack,
        method: 'PROCESS',
        route: label,
        timestamp: new Date().toISOString(),
      })
      .finally(() => process.exit(1));
  };

  process.on('uncaughtException', (error) =>
    handleFatal('Uncaught Exception', error),
  );
  process.on('unhandledRejection', (reason) =>
    handleFatal('Unhandled Rejection', reason),
  );
}
