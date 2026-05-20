import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  ICustomQuestionRepository,
  CustomQuestionWithOptions,
} from '../../../../domain/repositories';
import {
  CustomQuestionEntity,
  CustomQuestionOptionEntity,
} from '../../../../domain/entities';

@Injectable()
export class PrismaCustomQuestionRepository
  implements ICustomQuestionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CustomQuestionEntity | null> {
    const q = await this.prisma.customQuestion.findUnique({ where: { id } });
    return q ? this.toEntity(q) : null;
  }

  async findByIdWithOptions(
    id: string,
  ): Promise<CustomQuestionWithOptions | null> {
    const q = await this.prisma.customQuestion.findUnique({
      where: { id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return q ? this.toEntityWithOptions(q) : null;
  }

  async findManyByIdsWithOptions(
    ids: string[],
  ): Promise<CustomQuestionWithOptions[]> {
    if (!ids.length) return [];
    const list = await this.prisma.customQuestion.findMany({
      where: { id: { in: ids } },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return list.map((q) => this.toEntityWithOptions(q));
  }

  async findByExaminer(
    examinerId: string,
    filters?: { isActive?: boolean; search?: string },
  ): Promise<CustomQuestionWithOptions[]> {
    const where: any = { examinerId };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.statement = { contains: filters.search, mode: 'insensitive' };
    }
    const list = await this.prisma.customQuestion.findMany({
      where,
      include: { options: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((q) => this.toEntityWithOptions(q));
  }

  async create(
    data: Partial<CustomQuestionEntity>,
    options: Array<Omit<CustomQuestionOptionEntity, 'id' | 'questionId'>>,
  ): Promise<CustomQuestionWithOptions> {
    const created = await this.prisma.customQuestion.create({
      data: {
        ...(data as any),
        options: {
          create: options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            displayOrder: o.displayOrder,
          })),
        },
      },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return this.toEntityWithOptions(created);
  }

  async update(
    id: string,
    data: Partial<CustomQuestionEntity>,
    options?: Array<Omit<CustomQuestionOptionEntity, 'id' | 'questionId'>>,
  ): Promise<CustomQuestionWithOptions> {
    // Si vienen opciones nuevas, reemplazar todas (transaction)
    if (options) {
      await this.prisma.$transaction([
        this.prisma.customQuestionOption.deleteMany({
          where: { questionId: id },
        }),
        this.prisma.customQuestion.update({
          where: { id },
          data: {
            ...(data as any),
            options: {
              create: options.map((o) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                displayOrder: o.displayOrder,
              })),
            },
          },
        }),
      ]);
    } else {
      await this.prisma.customQuestion.update({
        where: { id },
        data: data as any,
      });
    }
    const updated = await this.prisma.customQuestion.findUnique({
      where: { id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return this.toEntityWithOptions(updated);
  }

  async delete(id: string): Promise<void> {
    // Soft delete: marcar como inactiva (preservar historial de answers)
    await this.prisma.customQuestion.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async countUsageInExams(id: string): Promise<number> {
    return this.prisma.customExamQuestion.count({ where: { questionId: id } });
  }

  private toEntity(raw: any): CustomQuestionEntity {
    const e = new CustomQuestionEntity();
    Object.assign(e, raw);
    return e;
  }

  private toEntityWithOptions(raw: any): CustomQuestionWithOptions {
    const e = this.toEntity(raw) as CustomQuestionWithOptions;
    e.options = (raw.options || []).map((o: any) => {
      const oe = new CustomQuestionOptionEntity();
      Object.assign(oe, o);
      return oe;
    });
    return e;
  }
}
