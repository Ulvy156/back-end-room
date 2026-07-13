import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PgBoss as PgBossClass,
  ScheduleOptions,
  SendOptions,
  WorkHandler,
  WorkOptions,
} from 'pg-boss';
import { QUEUE_JOBS } from './queue.jobs';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private boss!: PgBossClass;
  private readonly logger = new Logger(QueueService.name);

  // Resolves once boss.start() completes — awaited by QueueWorker before registering handlers.
  readonly ready: Promise<void>;
  private markReady!: () => void;

  constructor(private readonly config: ConfigService) {
    this.ready = new Promise((resolve) => {
      this.markReady = resolve;
    });
  }

  // pg-boss v12 is pure ESM so it must be loaded with dynamic import at runtime.
  // Static `import PgBoss from 'pg-boss'` would fail because this project compiles to CommonJS.
  async onModuleInit() {
    const { PgBoss } = await import('pg-boss');
    this.boss = new PgBoss({
      connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
      // Keep pg-boss's own pool small — it shares Supabase's session-pooler
      // connection cap (15 on the free tier) with PrismaService's pool, and
      // Render's zero-downtime deploys briefly run two instances at once,
      // doubling both pools' usage against that cap.
      max: 3,
    });
    // Surface pg-boss internal errors through NestJS logger instead of crashing the process.
    this.boss.on('error', (err) =>
      this.logger.error('pg-boss error', err.stack),
    );
    await this.boss.start();
    // pg-boss v12 requires queues to exist before work() or schedule() can use them.
    await Promise.all(
      Object.values(QUEUE_JOBS).map((name) => this.boss.createQueue(name)),
    );
    this.markReady();
    this.logger.log('pg-boss started');
  }

  async onModuleDestroy() {
    // Graceful shutdown — waits for active jobs to finish before disconnecting.
    await this.boss.stop();
  }

  // Enqueues a job. Returns the job ID, or null if a singleton/throttle policy blocked it.
  // Pass retry options (retryLimit, retryDelay, retryBackoff) here for per-job retry behaviour.
  async send<T extends object>(
    name: string,
    data: T,
    options?: SendOptions,
  ): Promise<string | null> {
    return this.boss.send(name, data, options);
  }

  // Registers a worker for the given queue name.
  // In pg-boss v12 the handler always receives an array — use jobs[0] when batchSize is 1 (default).
  // If the handler throws, pg-boss marks the job as failed and retries up to retryLimit.
  async work<T extends object>(
    name: string,
    handler: WorkHandler<T>,
  ): Promise<string>;
  async work<T extends object>(
    name: string,
    options: WorkOptions,
    handler: WorkHandler<T>,
  ): Promise<string>;
  async work<T extends object>(
    name: string,
    optionsOrHandler: WorkOptions | WorkHandler<T>,
    maybeHandler?: WorkHandler<T>,
  ): Promise<string> {
    if (maybeHandler) {
      return this.boss.work<T>(
        name,
        optionsOrHandler as WorkOptions,
        maybeHandler,
      );
    }
    return this.boss.work<T>(name, optionsOrHandler as WorkHandler<T>);
  }

  // Creates or updates a recurring cron schedule in the pgboss.schedule table.
  // The matching worker (registered via work()) will be invoked each time the cron fires.
  async schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: ScheduleOptions,
  ): Promise<void> {
    await this.boss.schedule(name, cron, data ?? null, options);
  }
}
