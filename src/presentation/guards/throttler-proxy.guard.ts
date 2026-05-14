import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Behind Nginx: use the real client IP from X-Forwarded-For
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can be "client, proxy1, proxy2" — take the first
      return Promise.resolve(
        (typeof forwarded === 'string' ? forwarded : forwarded[0])
          .split(',')[0]
          .trim(),
      );
    }
    return Promise.resolve(req.ip);
  }
}
