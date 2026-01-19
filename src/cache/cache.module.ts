import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    CacheModule.register({
      ttl: 1000, // no auto-expire TTL (seconds)
      max: 1000, // max key in memory
    }),
  ],
  providers: [CacheService],
  exports: [
    CacheService,
    CacheModule, // 👈 add this
  ],
})
export class AppCacheModule {}
