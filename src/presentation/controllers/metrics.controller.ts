import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { MetricsService } from '../../infrastructure/services/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  async getMetrics(@Req() req: Request, @Res() res: Response) {
    // Si METRICS_TOKEN esta definido, exigir bearer con ese token.
    // Sin token configurado, el endpoint queda como antes (suponiendo
    // que el reverse proxy filtra por red interna).
    const expected = process.env.METRICS_TOKEN;
    if (expected) {
      const auth = req.headers.authorization || '';
      const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (provided !== expected) {
        throw new UnauthorizedException();
      }
    }
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}
