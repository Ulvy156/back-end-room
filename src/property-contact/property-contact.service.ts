import { Injectable, Logger } from '@nestjs/common';
import { PhoneNumberType } from 'prisma/generated/enums';
import { QUEUE_JOBS, RecordPropertyContactClickJob } from '../queue/queue.jobs';
import { QueueService } from '../queue/queue.service';
import { CreatePropertyContactDto } from './dto/create-property-contact.dto';

@Injectable()
export class PropertyContactService {
  private readonly logger = new Logger(PropertyContactService.name);

  constructor(private readonly queue: QueueService) {}

  async recordClick(
    propertyId: string,
    dto: CreatePropertyContactDto,
  ): Promise<void> {
    try {
      await this.queue.send<RecordPropertyContactClickJob>(
        QUEUE_JOBS.RECORD_PROPERTY_CONTACT_CLICK,
        { propertyId, method: dto.method ?? PhoneNumberType.TELEGRAM },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    } catch (error) {
      this.logger.error('Failed to enqueue contact-click job', error);
    }
  }
}
