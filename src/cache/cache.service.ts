import { Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_KEYS } from './cache.key';

@Injectable()
export class CacheService {
  constructor(@Inject('CACHE_MANAGER') private cache: Cache) {}

  async get<T>(key: CACHE_KEYS): Promise<T | null> {
    return (await this.cache.get(key)) ?? null;
  }

  async set<T>(key: CACHE_KEYS, value: T, ttl = 3600): Promise<void> {
    await this.cache.set(key, value, ttl);
  }

  async del(key: CACHE_KEYS): Promise<void> {
    await this.cache.del(key);
  }
}
