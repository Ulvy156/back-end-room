import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [
    CacheModule.register({
      ttl: 1000, // no auto-expire TTL (seconds)
      max: 1000, // max key in memory
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
