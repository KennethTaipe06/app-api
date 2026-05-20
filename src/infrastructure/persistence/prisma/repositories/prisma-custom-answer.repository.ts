import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { ICustomAnswerRepository } from '../../../../domain/repositories';
import { CustomAnswerEntity } from '../../../../domain/entities';

@Injectable()
export class PrismaCustomAnswerRepository implements ICustomAnswerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySession(sessionId: string): Promise<CustomAnswerEntity[]> {
    const list = await this.prisma.customAnswer.findMany({
      where: { sessionId },
      orderBy: { answeredAt: 'asc' },
    });
    return list.map((a) => this.toEntity(a));
  }

  async findBySessionAndQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<CustomAnswerEntity | null> {
    const a = await this.prisma.customAnswer.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
    });
    return a ? this.toEntity(a) : null;
  }

  async create(data: Partial<CustomAnswerEntity>): Promise<CustomAnswerEntity> {
    const created = await this.prisma.customAnswer.create({
      data: data as any,
    });
    return this.toEntity(created);
  }

  private toEntity(raw: any): CustomAnswerEntity {
    const e = new CustomAnswerEntity();
    Object.assign(e, raw);
    e.selectedOptionIds = (raw.selectedOptionIds as string[]) ?? [];
    return e;
  }
}
