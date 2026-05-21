import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PgBoss as PgBossClass, ScheduleOptions, SendOptions, WorkHandler, WorkOptions } from 'pg-boss';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private boss!: PgBossClass;
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const { PgBoss } = await import('pg-boss');
    this.boss = new PgBoss({
      connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
    });
    this.boss.on('error', (err) => this.logger.error('pg-boss error', err));
    await this.boss.start();
    this.logger.log('pg-boss started');
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }

  async send<T extends object>(
    name: string,
    data: T,
    options?: SendOptions,
  ): Promise<string | null> {
    return this.boss.send(name, data, options);
  }

  async work<T extends object>(name: string, handler: WorkHandler<T>): Promise<string>;
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
      return this.boss.work<T>(name, optionsOrHandler as WorkOptions, maybeHandler);
    }
    return this.boss.work<T>(name, optionsOrHandler as WorkHandler<T>);
  }

  async schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: ScheduleOptions,
  ): Promise<void> {
    await this.boss.schedule(name, cron, data ?? null, options);
  }
}
