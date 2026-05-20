import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  ICustomExamSessionRepository,
  CustomSessionListItem,
} from '../../../../domain/repositories';
import { CustomExamSessionEntity } from '../../../../domain/entities';
import { CustomSessionStatus } from '../../../../domain/enums';

@Injectable()
export class PrismaCustomExamSessionRepository
  implements ICustomExamSessionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CustomExamSessionEntity | null> {
    const s = await this.prisma.customExamSession.findUnique({ where: { id } });
    return s ? this.toEntity(s) : null;
  }

  async findByExamAndCandidate(
    examId: string,
    candidateId: string,
  ): Promise<CustomExamSessionEntity | null> {
    const s = await this.prisma.customExamSession.findUnique({
      where: { examId_candidateId: { examId, candidateId } },
    });
    return s ? this.toEntity(s) : null;
  }

  async findByExam(examId: string): Promise<CustomSessionListItem[]> {
    const list = await this.prisma.customExamSession.findMany({
      where: { examId },
      include: {
        candidate: {
          select: { firstName: true, lastName: true, email: true },
        },
        exam: { select: { title: true } },
      },
      orderBy: [
        { percentage: 'desc' },
        { timeSpentSec: 'asc' },
      ],
    });
    return list.map((s) => this.toListItem(s));
  }

  async findByCandidate(
    candidateId: string,
  ): Promise<CustomSessionListItem[]> {
    const list = await this.prisma.customExamSession.findMany({
      where: { candidateId },
      include: {
        candidate: {
          select: { firstName: true, lastName: true, email: true },
        },
        exam: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((s) => this.toListItem(s));
  }

  async findGlobalRanking(
    examinerId: string,
    limit = 100,
  ): Promise<CustomSessionListItem[]> {
    // Solo sesiones completadas de examenes del examiner
    const list = await this.prisma.customExamSession.findMany({
      where: {
        status: CustomSessionStatus.COMPLETED,
        exam: { examinerId },
      },
      include: {
        candidate: {
          select: { firstName: true, lastName: true, email: true },
        },
        exam: { select: { title: true } },
      },
      orderBy: [
        { percentage: 'desc' },
        { timeSpentSec: 'asc' },
      ],
      take: limit,
    });
    return list.map((s) => this.toListItem(s));
  }

  async create(
    data: Partial<CustomExamSessionEntity>,
  ): Promise<CustomExamSessionEntity> {
    const created = await this.prisma.customExamSession.create({
      data: data as any,
    });
    return this.toEntity(created);
  }

  async createMany(
    data: Array<Partial<CustomExamSessionEntity>>,
  ): Promise<number> {
    const res = await this.prisma.customExamSession.createMany({
      data: data as any,
      skipDuplicates: true,
    });
    return res.count;
  }

  async update(
    id: string,
    data: Partial<CustomExamSessionEntity>,
  ): Promise<CustomExamSessionEntity> {
    const updated = await this.prisma.customExamSession.update({
      where: { id },
      data: data as any,
    });
    return this.toEntity(updated);
  }

  async updateStatus(
    id: string,
    status: CustomSessionStatus,
  ): Promise<CustomExamSessionEntity> {
    return this.update(id, { status });
  }

  private toEntity(raw: any): CustomExamSessionEntity {
    const e = new CustomExamSessionEntity();
    Object.assign(e, raw);
    // Prisma devuelve Json como objeto; aseguramos tipos
    e.questionOrder = (raw.questionOrder as string[]) ?? [];
    e.optionOrders =
      (raw.optionOrders as Record<string, string[]>) ?? {};
    return e;
  }

  private toListItem(raw: any): CustomSessionListItem {
    const e = this.toEntity(raw) as CustomSessionListItem;
    e.candidateName = raw.candidate
      ? `${raw.candidate.firstName} ${raw.candidate.lastName}`
      : '';
    e.candidateEmail = raw.candidate?.email ?? '';
    e.examTitle = raw.exam?.title ?? '';
    return e;
  }
}
