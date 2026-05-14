import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IResultRepository } from '../../../../domain/repositories';
import { ResultEntity, ScaleResultEntity } from '../../../../domain/entities';

@Injectable()
export class PrismaResultRepository implements IResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySession(sessionId: string): Promise<ResultEntity | null> {
    const result = await this.prisma.result.findUnique({
      where: { sessionId },
    });
    return result ? this.toEntity(result) : null;
  }

  async findBySessionWithScales(
    sessionId: string,
  ): Promise<(ResultEntity & { scaleResults: ScaleResultEntity[] }) | null> {
    const result = await this.prisma.result.findUnique({
      where: { sessionId },
      include: { scaleResults: { include: { scale: true } } },
    });
    if (!result) return null;
    return Object.assign(this.toEntity(result), {
      scaleResults: result.scaleResults.map((sr) => {
        const entity = new ScaleResultEntity();
        Object.assign(entity, sr);
        return entity;
      }),
    });
  }

  async create(
    data: Partial<ResultEntity>,
    scaleResults: Partial<ScaleResultEntity>[],
  ): Promise<ResultEntity> {
    const result = await this.prisma.result.create({
      data: {
        sessionId: data.sessionId!,
        totalScore: data.totalScore,
        interpretation: data.interpretation,
        rawData: data.rawData as any,
        scaleResults: {
          create: scaleResults.map((sr) => ({
            scaleId: sr.scaleId!,
            rawScore: sr.rawScore!,
            percentile: sr.percentile,
            stenScore: sr.stenScore,
            category: sr.category,
          })),
        },
      },
      include: { scaleResults: true },
    });
    return this.toEntity(result);
  }

  private toEntity(raw: any): ResultEntity {
    const entity = new ResultEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
