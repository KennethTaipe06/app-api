import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { ITestRepository } from '../../../../domain/repositories';
import { TestEntity } from '../../../../domain/entities';
import { TestType } from '../../../../domain/enums';

@Injectable()
export class PrismaTestRepository implements ITestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TestEntity | null> {
    const test = await this.prisma.test.findUnique({ where: { id } });
    return test ? this.toEntity(test) : null;
  }

  async findByIdWithScales(
    id: string,
  ): Promise<(TestEntity & { scales: unknown[] }) | null> {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { scales: { orderBy: { order: 'asc' } } },
    });
    return test
      ? Object.assign(this.toEntity(test), { scales: test.scales })
      : null;
  }

  async findByIdWithQuestions(
    id: string,
  ): Promise<(TestEntity & { questions: unknown[] }) | null> {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { questions: { orderBy: { number: 'asc' } } },
    });
    return test
      ? Object.assign(this.toEntity(test), { questions: test.questions })
      : null;
  }

  async findAll(filters?: {
    type?: TestType;
    isActive?: boolean;
  }): Promise<TestEntity[]> {
    const tests = await this.prisma.test.findMany({
      where: {
        type: filters?.type as any,
        isActive: filters?.isActive,
      },
      orderBy: { createdAt: 'desc' },
    });
    return tests.map((t) => this.toEntity(t));
  }

  async create(data: Partial<TestEntity>): Promise<TestEntity> {
    const test = await this.prisma.test.create({ data: data as any });
    return this.toEntity(test);
  }

  async update(id: string, data: Partial<TestEntity>): Promise<TestEntity> {
    const test = await this.prisma.test.update({
      where: { id },
      data: data as any,
    });
    return this.toEntity(test);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.test.delete({ where: { id } });
  }

  private toEntity(raw: any): TestEntity {
    const entity = new TestEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
