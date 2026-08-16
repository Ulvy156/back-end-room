import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PhoneNumberType } from 'prisma/generated/enums';
import { EmailService } from '../notification/email.service';
import { TelegramService } from '../notification/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_JOBS } from './queue.jobs';
import { QueueService } from './queue.service';
import { QueueWorker } from './queue.worker';

describe('QueueWorker', () => {
  let worker: QueueWorker;
  let queue: {
    ready: Promise<void>;
    work: jest.Mock;
    schedule: jest.Mock;
  };
  let prisma: { property: { update: jest.Mock } };
  let handlers: Map<string, (jobs: { data: unknown }[]) => Promise<void>>;

  beforeEach(async () => {
    handlers = new Map();
    prisma = { property: { update: jest.fn().mockResolvedValue(undefined) } };
    queue = {
      ready: Promise.resolve(),
      work: jest.fn((name: string, ...args: unknown[]) => {
        const handler = args[args.length - 1] as (
          jobs: { data: unknown }[],
        ) => Promise<void>;
        handlers.set(name, handler);
        return Promise.resolve('sub-id');
      }),
      schedule: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueWorker,
        { provide: QueueService, useValue: queue },
        { provide: EmailService, useValue: {} },
        { provide: TelegramService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
      ],
    }).compile();

    worker = module.get(QueueWorker);
    await worker.onModuleInit();
  });

  describe('RECORD_PROPERTY_CONTACT_CLICK handler', () => {
    it('atomically increments Property.contactCount', async () => {
      const handler = handlers.get(QUEUE_JOBS.RECORD_PROPERTY_CONTACT_CLICK);
      expect(handler).toBeDefined();

      await handler!([
        {
          data: { propertyId: 'property-1', method: PhoneNumberType.TELEGRAM },
        },
      ]);

      expect(prisma.property.update).toHaveBeenCalledWith({
        data: { contactCount: { increment: 1 } },
        where: { id: 'property-1' },
      });
    });
  });
});
