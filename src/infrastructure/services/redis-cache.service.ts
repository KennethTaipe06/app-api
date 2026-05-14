import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import type { ICacheService } from '../../application/ports/cache.port';

@Injectable()
export class RedisCacheService
  implements ICacheService, OnModuleInit, OnModuleDestroy
{
  private client: RedisClientType;
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get('REDIS_URL') ||
      `redis://:${this.config.get('REDIS_PASSWORD', '')}@${this.config.get('REDIS_HOST', 'localhost')}:${this.config.get('REDIS_PORT', '6379')}`;

    this.client = createClient({ url }) as RedisClientType;
    this.client.on('error', (err) =>
      this.logger.warn(`Redis error: ${err.message}`),
    );
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Redis conectado correctamente');
    } catch {
      this.logger.warn(
        'Redis no disponible — cache deshabilitado, la app funcionara sin cache',
      );
    }
  }

  async onModuleDestroy() {
    await this.client.disconnect().catch(() => {});
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
      // Redis no disponible, ignorar silenciosamente
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      // Redis no disponible, ignorar silenciosamente
    }
  }
}
