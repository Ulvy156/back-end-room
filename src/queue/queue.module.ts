import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { QueueService } from './queue.service';
import { QueueWorker } from './queue.worker';

@Global()
@Module({
  imports: [NotificationModule],
  providers: [QueueService, QueueWorker],
  exports: [QueueService],
})
export class QueueModule {}
