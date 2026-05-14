import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: client.Registry;

  // Contadores y histogramas
  readonly httpRequestsTotal: client.Counter<string>;
  readonly httpRequestDuration: client.Histogram<string>;
  readonly activeSessions: client.Gauge<string>;
  readonly examCompletions: client.Counter<string>;
  readonly aiRecommendations: client.Counter<string>;
  readonly proctoringAlerts: client.Counter<string>;

  constructor() {
    this.register = new client.Registry();

    // Metricas por defecto (CPU, memoria del proceso Node, event loop, etc.)
    client.collectDefaultMetrics({ register: this.register });

    // ── HTTP ──
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total de requests HTTP',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duracion de requests HTTP en segundos',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });

    // ── Negocio ──
    this.activeSessions = new client.Gauge({
      name: 'mindtalent_active_sessions',
      help: 'Sesiones de examen activas actualmente',
      registers: [this.register],
    });

    this.examCompletions = new client.Counter({
      name: 'mindtalent_exam_completions_total',
      help: 'Total de examenes completados',
      labelNames: ['test_type'],
      registers: [this.register],
    });

    this.aiRecommendations = new client.Counter({
      name: 'mindtalent_ai_recommendations_total',
      help: 'Total de recomendaciones IA generadas',
      labelNames: ['calificacion'],
      registers: [this.register],
    });

    this.proctoringAlerts = new client.Counter({
      name: 'mindtalent_proctoring_alerts_total',
      help: 'Total de alertas de proctoring',
      labelNames: ['type'],
      registers: [this.register],
    });
  }

  onModuleInit() {
    // El registro ya esta configurado en el constructor
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
