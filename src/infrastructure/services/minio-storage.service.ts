import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import type { Readable } from 'stream';
import type { IStorageService } from '../../application/ports/storage.port';

@Injectable()
export class MinioStorageService implements IStorageService, OnModuleInit {
  private client: Minio.Client;
  private available = false;
  private readonly logger = new Logger(MinioStorageService.name);
  private publicUrl: string | null = null;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get('MINIO_ENDPOINT', 'localhost');
    const explicitPort = this.config.get<string | undefined>('MINIO_PORT');
    const useSSL = this.config.get('MINIO_USE_SSL', 'false') === 'true';
    const accessKey =
      this.config.get('MINIO_ACCESS_KEY') ||
      this.config.get('MINIO_ROOT_USER', 'minioadmin');
    const secretKey =
      this.config.get('MINIO_SECRET_KEY') ||
      this.config.get('MINIO_ROOT_PASSWORD', 'minioadmin');

    const parsedPort = explicitPort
      ? parseInt(explicitPort, 10)
      : useSSL
        ? 443
        : 9000;

    this.client = new Minio.Client({
      endPoint: endpoint,
      port: parsedPort,
      useSSL,
      accessKey,
      secretKey,
      region: this.config.get('MINIO_REGION', 'us-east-1'),
    });

    this.region = this.config.get('MINIO_REGION', 'us-east-1');

    // URL publica de MinIO para generar URLs accesibles desde el navegador
    // Ej: https://minio.mindtalentth.com o https://mindeval.mindtalentth.com/storage
    this.publicUrl = this.config.get('MINIO_PUBLIC_URL', null);
  }

  async onModuleInit() {
    try {
      const buckets = [
        this.config.get('MINIO_RECORDINGS_BUCKET', 'recordings'),
        this.config.get('MINIO_REPORTS_BUCKET', 'reports'),
        this.config.get('MINIO_ATS_BUCKET', 'ats'),
      ];
      for (const bucket of buckets) {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket, this.region);
        }
      }
      this.available = true;
      this.logger.log('MinIO conectado correctamente');
    } catch (err) {
      this.logger.warn(
        'MinIO no disponible - las grabaciones no se almacenaran. Inicie MinIO para habilitar esta funcionalidad.',
      );
    }
  }

  async uploadFile(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    contentType: string,
    sizeBytes?: number,
  ): Promise<string> {
    if (!this.available) {
      this.logger.warn('MinIO no disponible, archivo no subido');
      return `${bucket}/${key}`;
    }

    const objectSize =
      typeof sizeBytes === 'number'
        ? sizeBytes
        : Buffer.isBuffer(data)
          ? data.length
          : undefined;

    await this.client.putObject(bucket, key, data, objectSize, {
      'Content-Type': contentType,
    });
    return `${bucket}/${key}`;
  }

  async getFileUrl(bucket: string, key: string): Promise<string> {
    if (!this.available) {
      return '';
    }
    const presignedUrl = await this.client.presignedGetObject(
      bucket,
      key,
      3600,
    );
    return this.toPublicUrlIfConfigured(presignedUrl);
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    if (!this.available) return;
    await this.client.removeObject(bucket, key);
  }

  async initiateMultipartUpload(
    bucket: string,
    key: string,
    contentType: string,
  ): Promise<string> {
    if (!this.available) {
      throw new Error('MinIO no disponible para multipart upload');
    }
    const headers = {
      'Content-Type': contentType,
    } as Record<string, string>;
    return this.client.initiateNewMultipartUpload(bucket, key, headers);
  }

  async getMultipartUploadPartUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresSec = 900,
  ): Promise<string> {
    if (!this.available) {
      throw new Error('MinIO no disponible para presigned part URL');
    }

    const reqParams = {
      partNumber: String(partNumber),
      uploadId,
    } as Record<string, string>;

    const url = await this.client.presignedUrl(
      'PUT',
      bucket,
      key,
      expiresSec,
      reqParams,
    );

    return this.toPublicUrlIfConfigured(url);
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    if (!this.available) {
      throw new Error('MinIO no disponible para completar multipart');
    }

    const etags = parts
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((part) => ({ part: part.partNumber, etag: part.etag }));

    await this.client.completeMultipartUpload(bucket, key, uploadId, etags);
  }

  async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<void> {
    if (!this.available) {
      return;
    }
    await this.client.abortMultipartUpload(bucket, key, uploadId);
  }

  async statObject(
    bucket: string,
    key: string,
  ): Promise<{ size: number } | null> {
    if (!this.available) {
      return null;
    }
    const stat = await this.client.statObject(bucket, key);
    return { size: stat.size };
  }

  private toPublicUrlIfConfigured(url: string): string {
    if (!this.publicUrl) {
      return url;
    }

    const parsed = new URL(url);
    const publicBase = this.publicUrl.replace(/\/$/, '');
    return `${publicBase}${parsed.pathname}${parsed.search}`;
  }
}
