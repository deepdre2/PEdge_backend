import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      url: config.get('UPSTASH_REDIS_REST_URL'),
      token: config.get('UPSTASH_REDIS_REST_TOKEN'),
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return await this.client.get<T>(key);
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    if (ttlMs) {
      await this.client.set(key, value, { px: ttlMs }); // px = milliseconds
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }
}