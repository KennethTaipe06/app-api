import {
  HttpCode,
  HttpStatus,
  Controller,
  Post,
  Get,
  Param,
  Body,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role, RecordingType } from '../../domain/enums';
import type {
  IRecordingRepository,
  ISessionRepository,
} from '../../domain/repositories';
import { RECORDING_REPOSITORY } from '../../domain/repositories/recording.repository';
import { SESSION_REPOSITORY } from '../../domain/repositories';
import type { IStorageService } from '../../application/ports/storage.port';
import { STORAGE_SERVICE } from '../../application/ports/storage.port';
import type { ICacheService } from '../../application/ports/cache.port';
import { CACHE_SERVICE } from '../../application/ports/cache.port';
import {
  AbortMinioMultipartDto,
  CompleteMinioMultipartDto,
  GetMinioPartUrlDto,
  InitMinioMultipartDto,
} from '../../application/dtos';
import { VideoProcessorService } from '../../infrastructure/services/video-processor.service';

type MultipartUploadState = {
  sessionId: string;
  userId: string;
  uploadId: string;
  objectKey: string;
  bucket: string;
  type: 'WEBCAM';
  contentType: string;
  status: 'initiated' | 'completed' | 'aborted';
  lastIssuedPartNumber: number;
  totalSizeBytes: number;
  issuedParts: Record<
    string,
    {
      sizeBytes: number;
      contentType: string;
      issuedAt: string;
    }
  >;
  recordingId?: string;
  createdAt: string;
  updatedAt: string;
};

@Controller('recordings')
export class RecordingsController {
  private readonly logger = new Logger(RecordingsController.name);
  private readonly localMultipartState = new Map<
    string,
    { state: MultipartUploadState; expiresAt: number }
  >();
  private readonly multipartBucket =
    process.env.MINIO_RECORDINGS_BUCKET ||
    process.env.MINIO_BUCKET ||
    'recordings';
  private readonly multipartStateTtlSec = parseInt(
    process.env.MINIO_MULTIPART_STATE_TTL_SEC || '21600',
    10,
  );
  private readonly multipartUrlTtlSec = parseInt(
    process.env.MINIO_PRESIGNED_PART_TTL_SEC || '900',
    10,
  );
  private readonly multipartMinPartSizeBytes = parseInt(
    process.env.MINIO_MULTIPART_MIN_PART_SIZE_BYTES || String(5 * 1024 * 1024),
    10,
  );

  constructor(
    @Inject(RECORDING_REPOSITORY)
    private readonly recordingRepository: IRecordingRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    @Inject(CACHE_SERVICE)
    private readonly cacheService: ICacheService,
    private readonly videoProcessorService: VideoProcessorService,
  ) {}

  @Post('minio/init')
  @Roles(Role.CANDIDATE)
  async initMinioMultipart(
    @Body() dto: InitMinioMultipartDto,
    @CurrentUser() user: any,
  ) {
    await this.assertSessionOwnership(dto.sessionId, user.id);

    const objectKey = this.buildMultipartObjectKey(dto.sessionId, dto.type);
    const uploadId = await this.storageService.initiateMultipartUpload(
      this.multipartBucket,
      objectKey,
      dto.contentType,
    );

    const now = new Date().toISOString();
    const state: MultipartUploadState = {
      sessionId: dto.sessionId,
      userId: user.id,
      uploadId,
      objectKey,
      bucket: this.multipartBucket,
      type: dto.type,
      contentType: dto.contentType,
      status: 'initiated',
      lastIssuedPartNumber: 0,
      totalSizeBytes: 0,
      issuedParts: {},
      createdAt: now,
      updatedAt: now,
    };

    await this.saveMultipartState(state);

    this.logger.log(
      `multipart init ok sessionId=${dto.sessionId} uploadId=${uploadId} objectKey=${objectKey}`,
    );

    return {
      uploadId,
      objectKey,
    };
  }

  @Post('minio/part-url')
  @Roles(Role.CANDIDATE)
  async getMultipartPartUrl(
    @Body() dto: GetMinioPartUrlDto,
    @CurrentUser() user: any,
  ) {
    await this.assertSessionOwnership(dto.sessionId, user.id);
    const state = await this.getAndValidateMultipartState(dto, user.id);

    if (dto.partNumber > state.lastIssuedPartNumber + 1) {
      throw new ConflictException({
        code: 'MULTIPART_INVALID_STATE',
        message:
          'Secuencia de parte invalida para el estado actual del multipart',
        field: 'partNumber',
        partNumber: dto.partNumber,
        lastIssuedPartNumber: state.lastIssuedPartNumber,
      });
    }

    const existingPart = state.issuedParts[String(dto.partNumber)];
    if (
      existingPart &&
      (existingPart.sizeBytes !== dto.sizeBytes ||
        existingPart.contentType !== dto.contentType)
    ) {
      throw new ConflictException({
        code: 'MULTIPART_INVALID_STATE',
        message:
          'Reintento invalido: sizeBytes/contentType no coincide con parte ya emitida',
        field: 'partNumber',
        partNumber: dto.partNumber,
      });
    }

    const url = await this.storageService.getMultipartUploadPartUrl(
      state.bucket,
      state.objectKey,
      state.uploadId,
      dto.partNumber,
      this.multipartUrlTtlSec,
    );

    if (!existingPart) {
      state.lastIssuedPartNumber = Math.max(
        state.lastIssuedPartNumber,
        dto.partNumber,
      );
      state.totalSizeBytes += dto.sizeBytes;
      state.issuedParts[String(dto.partNumber)] = {
        sizeBytes: dto.sizeBytes,
        contentType: dto.contentType,
        issuedAt: new Date().toISOString(),
      };
      state.updatedAt = new Date().toISOString();
      await this.saveMultipartState(state);
    }

    this.logger.log(
      `multipart part-url ok sessionId=${dto.sessionId} uploadId=${dto.uploadId} partNumber=${dto.partNumber}`,
    );

    return {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': dto.contentType,
      },
    };
  }

  @Post('minio/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.CANDIDATE)
  async completeMultipartUpload(
    @Body() dto: CompleteMinioMultipartDto,
    @CurrentUser() user: any,
  ) {
    await this.assertSessionOwnership(dto.sessionId, user.id);

    const recordingUrl = `${this.multipartBucket}/${dto.objectKey}`;
    const existingByUrlWithoutState =
      await this.recordingRepository.findBySessionAndUrl(
        dto.sessionId,
        recordingUrl,
      );
    if (existingByUrlWithoutState) {
      return this.serializeRecording(existingByUrlWithoutState);
    }

    const state = await this.getAndValidateMultipartState(dto, user.id);

    if (state.status === 'completed') {
      const existing = await this.findRecordingForCompletedState(state);
      if (existing) {
        return this.serializeRecording(existing);
      }
    }

    const normalizedParts = this.normalizeAndValidateParts(dto.parts);
    const stateRecordingUrl = `${state.bucket}/${state.objectKey}`;

    const smallNonFinalParts = this.findSmallNonFinalParts(
      state,
      normalizedParts,
    );
    if (smallNonFinalParts.length > 0) {
      await this.abortMultipartStateUploadBestEffort(
        state,
        `invalid-part-size:${smallNonFinalParts.join(',')}`,
      );
      throw new BadRequestException({
        code: 'MINIO_MULTIPART_PART_TOO_SMALL',
        message:
          'Uno o mas chunks son menores al minimo de 5MB para multipart (excepto la ultima parte). Use fallback de subida unica.',
        minPartSizeBytes: this.multipartMinPartSizeBytes,
        offendingPartNumbers: smallNonFinalParts,
      });
    }

    const existingByUrl = await this.recordingRepository.findBySessionAndUrl(
      dto.sessionId,
      stateRecordingUrl,
    );
    if (existingByUrl) {
      state.status = 'completed';
      state.recordingId = existingByUrl.id;
      state.updatedAt = new Date().toISOString();
      await this.saveMultipartState(state);
      return this.serializeRecording(existingByUrl);
    }

    try {
      await this.storageService.completeMultipartUpload(
        state.bucket,
        state.objectKey,
        state.uploadId,
        normalizedParts,
      );
    } catch (error: any) {
      if (error?.code === 'EntityTooSmall') {
        await this.abortMultipartStateUploadBestEffort(
          state,
          'entity-too-small',
        );
        throw new BadRequestException({
          code: 'MINIO_MULTIPART_PART_TOO_SMALL',
          message:
            'MinIO rechazo el multipart porque alguna parte no final es menor a 5MB. Use fallback de subida unica.',
          minPartSizeBytes: this.multipartMinPartSizeBytes,
        });
      }

      const maybeExisting = await this.recordingRepository.findBySessionAndUrl(
        dto.sessionId,
        stateRecordingUrl,
      );
      if (maybeExisting) {
        state.status = 'completed';
        state.recordingId = maybeExisting.id;
        state.updatedAt = new Date().toISOString();
        await this.saveMultipartState(state);
        return this.serializeRecording(maybeExisting);
      }
      throw error;
    }

    const objectStats = await this.storageService.statObject(
      state.bucket,
      state.objectKey,
    );

    const recording = await this.recordingRepository.create({
      sessionId: dto.sessionId,
      type: RecordingType.WEBCAM,
      url: stateRecordingUrl,
      durationSec: Math.round(dto.durationSec),
      sizeBytes: BigInt(objectStats?.size ?? state.totalSizeBytes),
    });

    state.status = 'completed';
    state.recordingId = recording.id;
    state.updatedAt = new Date().toISOString();
    await this.saveMultipartState(state);

    this.logger.log(
      `multipart complete ok sessionId=${dto.sessionId} uploadId=${dto.uploadId} parts=${normalizedParts.length}`,
    );

    return this.serializeRecording(recording);
  }

  @Post('minio/abort')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.CANDIDATE)
  async abortMultipartUpload(
    @Body() dto: AbortMinioMultipartDto,
    @CurrentUser() user: any,
  ) {
    await this.assertSessionOwnership(dto.sessionId, user.id);

    const state = await this.getMultipartState(dto.uploadId);
    if (!state) {
      this.logger.warn(
        `multipart abort idempotent miss sessionId=${dto.sessionId} uploadId=${dto.uploadId}`,
      );
      return { ok: true };
    }

    if (
      state.sessionId !== dto.sessionId ||
      state.userId !== user.id ||
      state.objectKey !== dto.objectKey
    ) {
      throw new ForbiddenException('Contexto de upload invalido');
    }

    try {
      await this.storageService.abortMultipartUpload(
        state.bucket,
        state.objectKey,
        state.uploadId,
      );
    } catch {
      // Idempotencia: si ya no existe el upload en MinIO, no romper flujo.
    }

    state.status = 'aborted';
    state.updatedAt = new Date().toISOString();
    const cacheKey = this.multipartStateCacheKey(state.uploadId);
    this.localMultipartState.delete(cacheKey);
    try {
      await this.cacheService.del(cacheKey);
    } catch {
      // Redis puede estar caido, el local Map ya fue limpiado
    }

    this.logger.log(
      `multipart abort ok sessionId=${dto.sessionId} uploadId=${dto.uploadId}`,
    );

    return { ok: true };
  }

  @Post('upload')
  @Roles(Role.CANDIDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) => {
          // Solo aceptar extensiones de video conocidas para evitar
          // que el cliente fuerce extensiones arbitrarias (p.ej. .exe).
          const ext = (
            path.extname(file.originalname || '') || ''
          ).toLowerCase();
          const allowed = new Set(['.mp4', '.webm', '.mov', '.mkv']);
          const safeExt = allowed.has(ext) ? ext : '.webm';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      limits: {
        // Limite duro de tamano para evitar DoS por subida masiva.
        // 1.5 GB es suficiente para una bateria completa con video continuo.
        fileSize: parseInt(
          process.env.RECORDING_MAX_BYTES || String(1_572_864_000),
          10,
        ),
        files: 1,
      },
      fileFilter: (_req, file, cb) => {
        const ok =
          typeof file.mimetype === 'string' &&
          /^video\/(webm|mp4|x-matroska|quicktime)$/.test(file.mimetype);
        if (!ok) {
          cb(new BadRequestException('Tipo de archivo no permitido'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
    @Body('type') type: string,
    @Body('durationSec') durationSec: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Archivo de grabacion requerido');
    }
    if (!sessionId || typeof sessionId !== 'string') {
      throw new BadRequestException('sessionId requerido');
    }
    if (type !== undefined && type !== 'WEBCAM' && type !== 'SCREEN') {
      throw new BadRequestException('type debe ser WEBCAM o SCREEN');
    }
    // Validar durationSec si vino, para evitar valores NaN/negativos.
    const parsedDuration =
      durationSec !== undefined ? parseInt(durationSec, 10) : null;
    if (
      parsedDuration !== null &&
      (Number.isNaN(parsedDuration) ||
        parsedDuration < 0 ||
        parsedDuration > 86400)
    ) {
      throw new BadRequestException('durationSec invalido');
    }

    await this.assertSessionOwnership(sessionId, user.id);

    const recordingType = type === 'SCREEN' ? 'SCREEN' : 'WEBCAM';
    const key = `sessions/${sessionId}/${recordingType.toLowerCase()}-${Date.now()}.webm`;

    let processedVideo: { outputPath: string; sizeBytes: number } | null = null;

    try {
      // Intentar procesar a H.265; si falla (ffmpeg no disponible), subir raw
      try {
        processedVideo = await this.videoProcessorService.processToH265(
          file.path,
        );
      } catch (err) {
        this.logger.warn(
          `H.265 processing failed for session=${sessionId}, uploading raw: ${(err as Error)?.message}`,
        );
      }

      const uploadPath = processedVideo?.outputPath ?? file.path;
      const uploadSize = processedVideo
        ? processedVideo.sizeBytes
        : (await fs.stat(file.path)).size;
      const contentType = processedVideo ? 'video/mp4' : 'video/webm';
      const storageKey = processedVideo
        ? key
        : key.replace('.webm', `-raw.webm`);

      const storagePath = await this.storageService.uploadFile(
        'recordings',
        storageKey,
        createReadStream(uploadPath),
        contentType,
        uploadSize,
      );

      const recording = await this.recordingRepository.create({
        sessionId,
        type: recordingType as any,
        url: storagePath,
        durationSec: parsedDuration,
        sizeBytes: BigInt(uploadSize),
      });

      return {
        id: recording.id,
        sessionId: recording.sessionId,
        type: recording.type,
        durationSec: recording.durationSec,
        sizeBytes: recording.sizeBytes?.toString(),
        createdAt: recording.createdAt,
      };
    } finally {
      await this.cleanupTempFile(file.path);
      await this.cleanupTempFile(processedVideo?.outputPath);
    }
  }

  private async cleanupTempFile(filePath?: string | null): Promise<void> {
    if (!filePath) {
      return;
    }
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignorar errores de limpieza de archivos temporales.
    }
  }

  @Get('session/:sessionId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getSessionRecordings(@Param('sessionId') sessionId: string) {
    // Si la sesión pertenece a una batería, devolver las grabaciones
    // de TODAS las sesiones hermanas (la grabación es continua para toda la batería)
    const session = await this.sessionRepository.findById(sessionId);
    if (session?.scheduledExamId) {
      const siblingIds = await this.sessionRepository.findIdsByScheduledExam(
        session.scheduledExamId,
        session.candidateId,
      );
      const allRecordings: any[] = [];
      for (const sid of siblingIds) {
        const recs = await this.recordingRepository.findBySessionId(sid);
        allRecordings.push(...recs);
      }
      // Deduplicar por URL (misma grabación no se repite)
      const seen = new Set<string>();
      const unique = allRecordings.filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
      return unique.map((r) => ({
        ...r,
        sizeBytes: r.sizeBytes?.toString(),
      }));
    }

    const recordings =
      await this.recordingRepository.findBySessionId(sessionId);
    return recordings.map((r) => ({
      ...r,
      sizeBytes: r.sizeBytes?.toString(),
    }));
  }

  @Get(':id/url')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getRecordingUrl(@Param('id') id: string) {
    const recording = await this.recordingRepository.findById(id);
    if (!recording) {
      throw new BadRequestException('Grabacion no encontrada');
    }

    const [bucket, ...keyParts] = recording.url.split('/');
    const key = keyParts.join('/');
    // Whitelist de buckets validos. Defensa profunda: aunque la URL
    // venga de BD, si en algun punto se contamina con un bucket arbitrario,
    // no debe permitirse firmar URLs hacia el.
    const allowedBuckets = new Set([
      this.multipartBucket,
      'recordings',
      'biometrics',
    ]);
    if (!bucket || !allowedBuckets.has(bucket)) {
      throw new BadRequestException('Bucket de grabacion invalido');
    }
    const url = await this.storageService.getFileUrl(bucket, key);

    return { url };
  }

  private buildMultipartObjectKey(sessionId: string, type: 'WEBCAM'): string {
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    return `sessions/${sessionId}/${type.toLowerCase()}-${suffix}.webm`;
  }

  private multipartStateCacheKey(uploadId: string): string {
    return `recordings:multipart:${uploadId}`;
  }

  private async getMultipartState(
    uploadId: string,
  ): Promise<MultipartUploadState | null> {
    const cacheKey = this.multipartStateCacheKey(uploadId);

    // Intentar Redis primero, pero si falla (timeout, conexión), usar local Map
    try {
      const stateFromCache =
        await this.cacheService.get<MultipartUploadState>(cacheKey);
      if (stateFromCache) {
        return stateFromCache;
      }
    } catch (err) {
      this.logger.warn(
        `Redis fallback: no se pudo leer estado multipart uploadId=${uploadId}: ${(err as Error)?.message}`,
      );
    }

    const local = this.localMultipartState.get(cacheKey);
    if (!local) {
      return null;
    }

    if (Date.now() > local.expiresAt) {
      this.localMultipartState.delete(cacheKey);
      return null;
    }

    return local.state;
  }

  private async saveMultipartState(state: MultipartUploadState): Promise<void> {
    const cacheKey = this.multipartStateCacheKey(state.uploadId);

    // Siempre guardar en local Map (en memoria del proceso)
    this.localMultipartState.set(cacheKey, {
      state,
      expiresAt: Date.now() + this.multipartStateTtlSec * 1000,
    });

    // Intentar guardar en Redis, pero no fallar si Redis esta caido
    try {
      await this.cacheService.set(cacheKey, state, this.multipartStateTtlSec);
    } catch (err) {
      this.logger.warn(
        `Redis fallback: no se pudo guardar estado multipart uploadId=${state.uploadId}: ${(err as Error)?.message}`,
      );
    }
  }

  private async getAndValidateMultipartState(
    dto: {
      sessionId: string;
      uploadId: string;
      objectKey: string;
    },
    userId: string,
  ): Promise<MultipartUploadState> {
    const state = await this.getMultipartState(dto.uploadId);
    if (!state) {
      throw new ConflictException({
        code: 'MULTIPART_INVALID_STATE',
        message: 'Upload multipart no inicializado, expirado o ya finalizado',
      });
    }

    if (
      state.sessionId !== dto.sessionId ||
      state.uploadId !== dto.uploadId ||
      state.objectKey !== dto.objectKey ||
      state.userId !== userId
    ) {
      throw new ForbiddenException('Contexto de upload invalido');
    }

    if (state.status === 'aborted') {
      throw new ConflictException({
        code: 'MULTIPART_INVALID_STATE',
        message: 'Upload multipart ya fue abortado',
      });
    }

    return state;
  }

  private normalizeAndValidateParts(
    parts: Array<{ partNumber: number; etag?: string; ETag?: string }>,
  ): Array<{ partNumber: number; etag: string }> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const uniquePartNumbers = new Set<number>();

    for (const part of sorted) {
      if (uniquePartNumbers.has(part.partNumber)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'partNumber duplicado en parts',
          field: `parts[${part.partNumber}].partNumber`,
        });
      }
      uniquePartNumbers.add(part.partNumber);

      const etag = (part.etag ?? part.ETag)?.trim();
      if (!etag) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'etag o ETag es requerido para cada parte',
          field: `parts[${part.partNumber}].etag`,
        });
      }
    }

    return sorted.map((part) => ({
      partNumber: part.partNumber,
      etag: (part.etag ?? part.ETag ?? '').replace(/^"+|"+$/g, ''),
    }));
  }

  private findSmallNonFinalParts(
    state: MultipartUploadState,
    parts: Array<{ partNumber: number; etag: string }>,
  ): number[] {
    if (parts.length <= 1) {
      return [];
    }

    const nonFinalParts = parts.slice(0, -1);
    const offenders: number[] = [];

    for (const part of nonFinalParts) {
      const issued = state.issuedParts[String(part.partNumber)];
      if (!issued) {
        continue;
      }
      if (issued.sizeBytes < this.multipartMinPartSizeBytes) {
        offenders.push(part.partNumber);
      }
    }

    return offenders;
  }

  private async abortMultipartStateUploadBestEffort(
    state: MultipartUploadState,
    reason: string,
  ): Promise<void> {
    try {
      await this.storageService.abortMultipartUpload(
        state.bucket,
        state.objectKey,
        state.uploadId,
      );
    } catch {
      // Ignorar error para mantener fallback fluido.
    }

    state.status = 'aborted';
    state.updatedAt = new Date().toISOString();
    const cacheKey = this.multipartStateCacheKey(state.uploadId);
    this.localMultipartState.delete(cacheKey);
    try {
      await this.cacheService.del(cacheKey);
    } catch {
      // Redis puede estar caido, el local Map ya fue limpiado
    }

    this.logger.warn(
      `multipart aborted sessionId=${state.sessionId} uploadId=${state.uploadId} reason=${reason}`,
    );
  }

  private async assertSessionOwnership(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new BadRequestException('Sesion no encontrada');
    }
    if (session.candidateId !== userId) {
      throw new ForbiddenException('La sesion no pertenece al candidato');
    }
  }

  private async findRecordingForCompletedState(state: MultipartUploadState) {
    if (state.recordingId) {
      const byId = await this.recordingRepository.findById(state.recordingId);
      if (byId) {
        return byId;
      }
    }
    return this.recordingRepository.findBySessionAndUrl(
      state.sessionId,
      `${state.bucket}/${state.objectKey}`,
    );
  }

  private serializeRecording(recording: {
    id: string;
    sessionId: string;
    type: string;
    durationSec: number | null;
    sizeBytes: bigint | null;
    createdAt: Date;
    url?: string;
  }) {
    return {
      id: recording.id,
      sessionId: recording.sessionId,
      type: recording.type,
      url: recording.url,
      durationSec: recording.durationSec,
      sizeBytes: recording.sizeBytes?.toString() ?? null,
      createdAt: recording.createdAt,
    };
  }
}
