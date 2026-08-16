import { Test, TestingModule } from '@nestjs/testing';
import { PhoneNumberType } from 'prisma/generated/enums';
import { QUEUE_JOBS } from '../queue/queue.jobs';
import { QueueService } from '../queue/queue.service';
import { PropertyContactService } from './property-contact.service';

describe('PropertyContactService', () => {
  let service: PropertyContactService;
  let queue: { send: jest.Mock };

  beforeEach(async () => {
    queue = { send: jest.fn().mockResolvedValue('job-id') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyContactService,
        { provide: QueueService, useValue: queue },
      ],
    }).compile();

    service = module.get(PropertyContactService);
  });

  describe('recordClick', () => {
    it('enqueues a RECORD_PROPERTY_CONTACT_CLICK job with the given propertyId and method', async () => {
      await service.recordClick('property-1', {
        method: PhoneNumberType.TELEGRAM,
      });

      expect(queue.send).toHaveBeenCalledWith(
        QUEUE_JOBS.RECORD_PROPERTY_CONTACT_CLICK,
        { propertyId: 'property-1', method: PhoneNumberType.TELEGRAM },
        { retryLimit: 3, retryDelay: 30, retryBackoff: true },
      );
    });

    it('defaults method to TELEGRAM when omitted', async () => {
      await service.recordClick('property-1', {});

      expect(queue.send).toHaveBeenCalledWith(
        QUEUE_JOBS.RECORD_PROPERTY_CONTACT_CLICK,
        { propertyId: 'property-1', method: PhoneNumberType.TELEGRAM },
        expect.any(Object),
      );
    });

    it('swallows and logs a queue failure instead of throwing', async () => {
      queue.send.mockRejectedValueOnce(new Error('queue unavailable'));

      await expect(
        service.recordClick('property-1', {}),
      ).resolves.toBeUndefined();
    });
  });
});
