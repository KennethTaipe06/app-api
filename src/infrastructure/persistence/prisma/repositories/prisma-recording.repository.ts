import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IRecordingRepository } from '../../../../domain/repositories/recording.repository';
import { RecordingEntity } from '../../../../domain/entities';

@Injectable()
export class PrismaRecordingRepository implements IRecordingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Partial<RecordingEntity>): Promise<RecordingEntity> {
    const recording = await this.prisma.recording.create({
      data: {
        sessionId: data.sessionId!,
        type: data.type as any,
        url: data.url!,
        durationSec: data.durationSec || null,
        sizeBytes: data.sizeBytes || null,
      },
    });
    return this.toEntity(recording);
  }

  async findBySessionId(sessionId: string): Promise<RecordingEntity[]> {
    const recordings = await this.prisma.recording.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    return recordings.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<RecordingEntity | null> {
    const recording = await this.prisma.recording.findUnique({
      where: { id },
    });
    return recording ? this.toEntity(recording) : null;
  }

  async findBySessionAndUrl(
    sessionId: string,
    url: string,
  ): Promise<RecordingEntity | null> {
    const recording = await this.prisma.recording.findFirst({
      where: { sessionId, url },
      orderBy: { createdAt: 'desc' },
    });
    return recording ? this.toEntity(recording) : null;
  }

  private toEntity(raw: any): RecordingEntity {
    const entity = new RecordingEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
