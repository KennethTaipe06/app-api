import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  ICustomExamRepository,
  CustomExamWithQuestions,
} from '../../../../domain/repositories';
import { CustomExamEntity } from '../../../../domain/entities';

@Injectable()
export class PrismaCustomExamRepository implements ICustomExamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CustomExamEntity | null> {
    const exam = await this.prisma.customExam.findUnique({ where: { id } });
    return exam ? this.toEntity(exam) : null;
  }

  async findByIdWithQuestions(
    id: string,
  ): Promise<CustomExamWithQuestions | null> {
    const exam = await this.prisma.customExam.findUnique({
      where: { id },
      include: {
        examQuestions: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!exam) return null;
    return Object.assign(this.toEntity(exam), {
      examQuestions: exam.examQuestions.map((q) => ({
        id: q.id,
        questionId: q.questionId,
        displayOrder: q.displayOrder,
      })),
    });
  }

  async findByExaminer(
    examinerId: string,
    filters?: { isActive?: boolean },
  ): Promise<CustomExamEntity[]> {
    const where: any = { examinerId };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    const list = await this.prisma.customExam.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((e) => this.toEntity(e));
  }

  async create(
    data: Partial<CustomExamEntity>,
    questionIds: string[],
  ): Promise<CustomExamWithQuestions> {
    const created = await this.prisma.customExam.create({
      data: {
        ...(data as any),
        examQuestions: {
          create: questionIds.map((qid, idx) => ({
            questionId: qid,
            displayOrder: idx + 1,
          })),
        },
      },
      include: { examQuestions: { orderBy: { displayOrder: 'asc' } } },
    });
    return Object.assign(this.toEntity(created), {
      examQuestions: created.examQuestions.map((q) => ({
        id: q.id,
        questionId: q.questionId,
        displayOrder: q.displayOrder,
      })),
    });
  }

  async update(
    id: string,
    data: Partial<CustomExamEntity>,
    questionIds?: string[],
  ): Promise<CustomExamWithQuestions> {
    if (questionIds) {
      await this.prisma.$transaction([
        this.prisma.customExamQuestion.deleteMany({ where: { examId: id } }),
        this.prisma.customExam.update({
          where: { id },
          data: {
            ...(data as any),
            examQuestions: {
              create: questionIds.map((qid, idx) => ({
                questionId: qid,
                displayOrder: idx + 1,
              })),
            },
          },
        }),
      ]);
    } else {
      await this.prisma.customExam.update({
        where: { id },
        data: data as any,
      });
    }
    const updated = await this.prisma.customExam.findUnique({
      where: { id },
      include: { examQuestions: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!updated) throw new Error('Examen no encontrado luego de actualizar');
    return Object.assign(this.toEntity(updated), {
      examQuestions: updated.examQuestions.map((q) => ({
        id: q.id,
        questionId: q.questionId,
        displayOrder: q.displayOrder,
      })),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete
    await this.prisma.customExam.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private toEntity(raw: any): CustomExamEntity {
    const e = new CustomExamEntity();
    Object.assign(e, raw);
    return e;
  }
}
