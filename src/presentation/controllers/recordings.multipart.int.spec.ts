import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { RecordingsController } from './recordings.controller';
import {
  RECORDING_REPOSITORY,
  SESSION_REPOSITORY,
} from '../../domain/repositories';
import { STORAGE_SERVICE } from '../../application/ports/storage.port';
import { CACHE_SERVICE } from '../../application/ports/cache.port';
import { VideoProcessorService } from '../../infrastructure/services/video-processor.service';

describe('RecordingsController multipart integration', () => {
  let app: INestApplication;

  const cacheStore = new Map<string, any>();

  const recordingRepository = {
    create: jest.fn(),
    findBySessionId: jest.fn(),
    findById: jest.fn(),
    findBySessionAndUrl: jest.fn(),
  };

  const sessionRepository = {
    findById: jest.fn(),
    findByIdWithRelations: jest.fn(),
    findByCandidate: jest.fn(),
    findActive: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const storageService = {
    uploadFile: jest.fn(),
    getFileUrl: jest.fn(),
    deleteFile: jest.fn(),
    initiateMultipartUpload: jest.fn(),
    getMultipartUploadPartUrl: jest.fn(),
    completeMultipartUpload: jest.fn(),
    abortMultipartUpload: jest.fn(),
    statObject: jest.fn(),
  };

  const cacheService = {
    get: jest.fn((key: string) => Promise.resolve(cacheStore.get(key) ?? null)),
    set: jest.fn((key: string, value: any) => {
      cacheStore.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      cacheStore.delete(key);
      return Promise.resolve();
    }),
  };

  beforeEach(async () => {
    cacheStore.clear();
    jest.clearAllMocks();

    (sessionRepository.findById as any).mockResolvedValue({
      id: 'session-1',
      candidateId: 'candidate-1',
    });

    (storageService.initiateMultipartUpload as any).mockResolvedValue(
      'upload-1',
    );
    (storageService.getMultipartUploadPartUrl as any).mockResolvedValue(
      'https://minio.local/presigned-part',
    );
    (storageService.completeMultipartUpload as any).mockResolvedValue(
      undefined,
    );
    (storageService.abortMultipartUpload as any).mockResolvedValue(undefined);
    (storageService.statObject as any).mockResolvedValue({ size: 2048 });

    (recordingRepository.findBySessionAndUrl as any).mockResolvedValue(null);
    (recordingRepository.findById as any).mockResolvedValue(null);
    (recordingRepository.create as any).mockResolvedValue({
      id: 'rec-1',
      sessionId: 'session-1',
      type: 'WEBCAM',
      url: 'recordings/sessions/session-1/webcam-x.mp4',
      durationSec: 30,
      sizeBytes: BigInt(2048),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [RecordingsController],
      providers: [
        { provide: RECORDING_REPOSITORY, useValue: recordingRepository },
        { provide: SESSION_REPOSITORY, useValue: sessionRepository },
        { provide: STORAGE_SERVICE, useValue: storageService },
        { provide: CACHE_SERVICE, useValue: cacheService },
        {
          provide: VideoProcessorService,
          useValue: { processToH265: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: 'candidate-1', role: 'CANDIDATE' };
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('init should create multipart context', async () => {
    const response = await request(app.getHttpServer())
      .post('/recordings/minio/init')
      .send({
        sessionId: 'session-1',
        type: 'WEBCAM',
        contentType: 'video/webm',
      })
      .expect(201);

    expect(response.body.uploadId).toBe('upload-1');
    expect(response.body.objectKey).toContain('sessions/session-1/webcam-');
    expect(storageService.initiateMultipartUpload).toHaveBeenCalledTimes(1);
    expect(cacheService.set).toHaveBeenCalledTimes(1);
  });

  it('part-url should allow retry with same part', async () => {
    const init = await request(app.getHttpServer())
      .post('/recordings/minio/init')
      .send({
        sessionId: 'session-1',
        type: 'WEBCAM',
        contentType: 'video/webm',
      })
      .expect(201);

    const payload = {
      sessionId: 'session-1',
      uploadId: init.body.uploadId,
      objectKey: init.body.objectKey,
      partNumber: 1,
      contentType: 'video/webm',
      sizeBytes: 1024,
    };

    const first = await request(app.getHttpServer())
      .post('/recordings/minio/part-url')
      .send(payload)
      .expect(201);

    expect(first.body.method).toBe('PUT');
    expect(first.body.url).toContain('presigned-part');

    await request(app.getHttpServer())
      .post('/recordings/minio/part-url')
      .send(payload)
      .expect(201);

    expect(storageService.getMultipartUploadPartUrl).toHaveBeenCalledTimes(2);
  });

  it('complete should persist final recording', async () => {
    const init = await request(app.getHttpServer())
      .post('/recordings/minio/init')
      .send({
        sessionId: 'session-1',
        type: 'WEBCAM',
        contentType: 'video/webm',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/recordings/minio/part-url')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        partNumber: 1,
        contentType: 'video/webm',
        sizeBytes: 2048,
      })
      .expect(201);

    const completed = await request(app.getHttpServer())
      .post('/recordings/minio/complete')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        type: 'WEBCAM',
        contentType: 'video/webm',
        durationSec: 30,
        parts: [{ partNumber: 1, etag: '"etag-1"' }],
      })
      .expect(200);

    expect(storageService.completeMultipartUpload).toHaveBeenCalledTimes(1);
    expect(recordingRepository.create).toHaveBeenCalledTimes(1);
    expect(completed.body.id).toBe('rec-1');
    expect(completed.body.sizeBytes).toBe('2048');
  });

  it('complete should accept parts with ETag field', async () => {
    const init = await request(app.getHttpServer())
      .post('/recordings/minio/init')
      .send({
        sessionId: 'session-1',
        type: 'WEBCAM',
        contentType: 'video/webm',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/recordings/minio/part-url')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        partNumber: 1,
        contentType: 'video/webm',
        sizeBytes: 2048,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/recordings/minio/complete')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        type: 'WEBCAM',
        contentType: 'video/webm',
        durationSec: 30,
        parts: [{ partNumber: 1, ETag: '"etag-1"' }],
      })
      .expect(200);

    expect(storageService.completeMultipartUpload).toHaveBeenCalledTimes(1);
  });

  it('abort should be idempotent', async () => {
    const init = await request(app.getHttpServer())
      .post('/recordings/minio/init')
      .send({
        sessionId: 'session-1',
        type: 'WEBCAM',
        contentType: 'video/webm',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/recordings/minio/abort')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
      })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/recordings/minio/abort')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
      })
      .expect(200);

    expect(second.body.ok).toBe(true);
  });

  it('complete should return 400 when non-final part is too small and abort upload', async () => {
    const init = await request(app.getHttpServer())
      .post('/recordings/minio/init')
      .send({
        sessionId: 'session-1',
        type: 'WEBCAM',
        contentType: 'video/webm',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/recordings/minio/part-url')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        partNumber: 1,
        contentType: 'video/webm',
        sizeBytes: 1024,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/recordings/minio/part-url')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        partNumber: 2,
        contentType: 'video/webm',
        sizeBytes: 1024,
      })
      .expect(201);

    const completed = await request(app.getHttpServer())
      .post('/recordings/minio/complete')
      .send({
        sessionId: 'session-1',
        uploadId: init.body.uploadId,
        objectKey: init.body.objectKey,
        type: 'WEBCAM',
        contentType: 'video/webm',
        durationSec: 30,
        parts: [
          { partNumber: 1, etag: '"etag-1"' },
          { partNumber: 2, etag: '"etag-2"' },
        ],
      })
      .expect(400);

    expect(completed.body.message).toContain('Uno o mas chunks');
    expect(storageService.abortMultipartUpload).toHaveBeenCalledTimes(1);
    expect(storageService.completeMultipartUpload).toHaveBeenCalledTimes(0);
  });

  it('complete should return 409 when multipart state does not exist', async () => {
    const response = await request(app.getHttpServer())
      .post('/recordings/minio/complete')
      .send({
        sessionId: 'session-1',
        uploadId: 'missing-upload-id',
        objectKey: 'sessions/session-1/webcam-missing.mp4',
        type: 'WEBCAM',
        contentType: 'video/webm',
        durationSec: 30,
        parts: [{ partNumber: 1, etag: '"etag-1"' }],
      })
      .expect(409);

    expect(response.body.code).toBe('MULTIPART_INVALID_STATE');
  });
});
