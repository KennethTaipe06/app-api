import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../../infrastructure/services/metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // No medir el endpoint de metricas para evitar recursion
    if (req.path.endsWith('/metrics')) {
      return next();
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationSec = durationNs / 1e9;

      // Normalizar path: reemplazar UUIDs y IDs numericos con :id
      const normalizedPath =
        req.route?.path ||
        req.path.replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          ':id',
        );

      const labels = {
        method: req.method,
        path: normalizedPath,
        status: String(res.statusCode),
      };

      this.metricsService.httpRequestsTotal.inc(labels);
      this.metricsService.httpRequestDuration.observe(labels, durationSec);
    });

    next();
  }
}
