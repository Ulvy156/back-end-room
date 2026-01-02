import { Module } from '@nestjs/common';
import { PropertyImageService } from './property-image.service';
import { PropertyImageController } from './property-image.controller';
import { R2Module } from 'src/R2/r2.module';

@Module({
  imports: [R2Module],
  controllers: [PropertyImageController],
  providers: [PropertyImageService],
})
export class PropertyImageModule {}
