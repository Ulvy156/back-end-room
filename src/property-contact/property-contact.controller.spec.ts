import { Test, TestingModule } from '@nestjs/testing';
import { PhoneNumberType } from 'prisma/generated/enums';
import { PropertyContactController } from './property-contact.controller';
import { PropertyContactService } from './property-contact.service';

describe('PropertyContactController', () => {
  let controller: PropertyContactController;
  let service: { recordClick: jest.Mock };

  beforeEach(async () => {
    service = { recordClick: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyContactController],
      providers: [{ provide: PropertyContactService, useValue: service }],
    }).compile();

    controller = module.get(PropertyContactController);
  });

  describe('recordContactClick', () => {
    it('delegates to the service with the propertyId param and body dto', async () => {
      const dto = { method: PhoneNumberType.TELEGRAM };

      await controller.recordContactClick('property-1', dto);

      expect(service.recordClick).toHaveBeenCalledWith('property-1', dto);
    });
  });
});
