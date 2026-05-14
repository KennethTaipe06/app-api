import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { ISessionRepository } from '../../../../domain/repositories';
import { ExamSessionEntity } from '../../../../domain/entities';
import { SessionStatus } from '../../../../domain/enums';

@Injectable()
export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ExamSessionEntity | null> {
    const session = await this.prisma.examSession.findUnique({ where: { id } });
    return session ? this.toEntity(session) : null;
  }

  async findByIdWithRelations(id: string): Promise<ExamSessionEntity | null> {
    const session = await this.prisma.examSession.findUnique({
      where: { id },
      include: { test: true, candidate: true, answers: true, result: true },
    });
    return session ? this.toEntity(session) : null;
  }

  async findByCandidate(candidateId: string): Promise<ExamSessionEntity[]> {
    const sessions = await this.prisma.examSession.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => this.toEntity(s));
  }

  async findActive(): Promise<ExamSessionEntity[]> {
    const sessions = await this.prisma.examSession.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { candidate: true, test: true },
      orderBy: { startedAt: 'desc' },
    });
    return sessions.map((s) => this.toEntity(s));
  }

  async findAll(filters?: {
    status?: SessionStatus;
    testId?: string;
  }): Promise<ExamSessionEntity[]> {
    const sessions = await this.prisma.examSession.findMany({
      where: {
        status: filters?.status as any,
        testId: filters?.testId,
      },
      include: { candidate: true, test: true },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => this.toEntity(s));
  }

  async create(data: Partial<ExamSessionEntity>): Promise<ExamSessionEntity> {
    const session = await this.prisma.examSession.create({ data: data as any });
    return this.toEntity(session);
  }

  async update(
    id: string,
    data: Partial<ExamSessionEntity>,
  ): Promise<ExamSessionEntity> {
    const session = await this.prisma.examSession.update({
      where: { id },
      data: data as any,
    });
    return this.toEntity(session);
  }

  async findIdsByScheduledExam(
    scheduledExamId: string,
    candidateId: string,
  ): Promise<string[]> {
    const sessions = await this.prisma.examSession.findMany({
      where: { scheduledExamId, candidateId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return sessions.map((s) => s.id);
  }

  private toEntity(raw: any): ExamSessionEntity {
    const entity = new ExamSessionEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
