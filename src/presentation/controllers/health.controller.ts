import { Controller, Get } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await (this.prisma as any).$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'degraded',
        db: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
