import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IAnswerRepository } from '../../../../domain/repositories';
import { AnswerEntity } from '../../../../domain/entities';

@Injectable()
export class PrismaAnswerRepository implements IAnswerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySession(sessionId: string): Promise<AnswerEntity[]> {
    const answers = await this.prisma.answer.findMany({
      where: { sessionId },
      orderBy: { questionNumber: 'asc' },
    });
    return answers.map((a) => this.toEntity(a));
  }

  async create(data: Partial<AnswerEntity>): Promise<AnswerEntity> {
    const answer = await this.prisma.answer.create({ data: data as any });
    return this.toEntity(answer);
  }

  async createMany(answers: Partial<AnswerEntity>[]): Promise<number> {
    const result = await this.prisma.answer.createMany({
      data: answers as any,
      skipDuplicates: true, // Ignorar respuestas ya guardadas (re-envios)
    });
    return result.count;
  }

  private toEntity(raw: any): AnswerEntity {
    const entity = new AnswerEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
