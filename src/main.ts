import cluster from 'node:cluster';
import os from 'node:os';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './infrastructure/config/redis-io.adapter';

const WORKERS =
  parseInt(process.env.CLUSTER_WORKERS || '0', 10) || os.cpus().length;
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap');

  // Fail-fast: secrets criticos deben estar presentes.
  // Evita arrancar con valores por defecto inseguros en produccion.
  const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = requiredSecrets.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    bootstrapLogger.error(
      `Variables de entorno requeridas ausentes: ${missing.join(', ')}. Abortando arranque.`,
    );
    process.exit(1);
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    bootstrapLogger.error(
      'JWT_SECRET y JWT_REFRESH_SECRET no pueden ser iguales. Abortando.',
    );
    process.exit(1);
  }
  if ((process.env.JWT_SECRET || '').length < 32) {
    bootstrapLogger.warn(
      'JWT_SECRET tiene menos de 32 caracteres; se recomienda >= 32 bytes de entropia.',
    );
  }

  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Seguridad HTTP headers
  app.use(helmet());

  // Limites de payload JSON / urlencoded. Por defecto express acepta 100kb;
  // lo subimos a 10MB para soportar screenshots base64 y batches de respuestas,
  // pero topado para evitar DoS. Uploads de video usan multipart con su
  // propio limite via FileInterceptor.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Request logging (solo errores y warnings en produccion para reducir I/O)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`;

      if (res.statusCode >= 500) {
        Logger.error(message, undefined, 'HTTP');
        return;
      }

      if (res.statusCode >= 400) {
        Logger.warn(message, 'HTTP');
        return;
      }

      // En produccion, no loggear cada request exitoso (reduce I/O disco)
      if (!isProduction) {
        Logger.log(message, 'HTTP');
      }
    });

    next();
  });

  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  const allowedOrigins = (
    process.env.CORS_ORIGIN || 'http://localhost:3000'
  ).split(',');
  app.enableCors({
    // No usar comodin con credentials. allowedOrigins viene de env.
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // Solo los headers que realmente recibe la API. Los uploads multipart
    // a MinIO van directo al storage con URLs presignadas; la API no recibe
    // headers x-amz-*, asi que no deben estar en la allowlist.
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['ETag'],
    maxAge: 3600,
  });

  // Redis adapter para Socket.IO — comparte eventos entre workers del cluster
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Graceful shutdown: cerrar conexiones antes de morir
  app.enableShutdownHooks();

  const port = parseInt(process.env.API_PORT || '3001', 10);
  await app.listen(port);

  // Extender timeouts del servidor HTTP para requests de larga duracion
  // (ej: regeneracion IA de todos los candidatos puede tomar varios minutos).
  const httpServer = app.getHttpServer();
  httpServer.setTimeout(0);          // sin timeout de socket
  httpServer.keepAliveTimeout = 620_000;  // > timeout del proxy/LB
  httpServer.headersTimeout    = 625_000;

  bootstrapLogger.log(
    `MindTalent API worker ${process.pid} running on port ${port}`,
  );
}

if (cluster.isPrimary) {
  const logger = new Logger('Cluster');
  logger.log(`Primary ${process.pid} starting ${WORKERS} workers...`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    if (code !== 0) {
      logger.warn(
        `Worker ${worker.process.pid} died (code ${code}) — restarting`,
      );
      cluster.fork();
    }
  });

  // Graceful shutdown del cluster
  const shutdown = () => {
    logger.log('Shutting down cluster...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill('SIGTERM');
    }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  bootstrap();
}
