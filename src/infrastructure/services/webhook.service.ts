import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebhookPayload {
  event: string;
  sessionId: string;
  candidateId: string;
  candidateName?: string;
  testName?: string;
  reason: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookUrl: string | null;
  private readonly webhookSecret: string | null;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = this.config.get('WEBHOOK_EXAMINER_URL', null);
    this.webhookSecret = this.config.get('WEBHOOK_SECRET', null);
    this.timeoutMs = parseInt(
      this.config.get('WEBHOOK_TIMEOUT_MS', '10000'),
      10,
    );
  }

  async notifyExaminer(payload: WebhookPayload): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logger.warn(
        `Webhook no configurado (WEBHOOK_EXAMINER_URL). Evento ${payload.event} para sesion ${payload.sessionId} no enviado.`,
      );
      return false;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.webhookSecret) {
      headers['X-Webhook-Secret'] = this.webhookSecret;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(
          `Webhook respondio con HTTP ${response.status} para sesion ${payload.sessionId}`,
        );
        return false;
      }

      this.logger.log(
        `Webhook enviado OK: ${payload.event} sesion=${payload.sessionId}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Error enviando webhook para sesion ${payload.sessionId}: ${(err as Error)?.message}`,
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
