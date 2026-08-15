import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { DynamicImagesInterceptor } from './dynamic-images.interceptor';

@Global()
@Module({
  providers: [R2Service, DynamicImagesInterceptor],
  exports: [R2Service, DynamicImagesInterceptor],
})
export class R2Module {}
