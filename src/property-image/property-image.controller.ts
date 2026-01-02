import { Controller } from '@nestjs/common';
import { PropertyImageService } from './property-image.service';

@Controller('property-image')
export class PropertyImageController {
  constructor(private readonly propertyImageService: PropertyImageService) {}
}
