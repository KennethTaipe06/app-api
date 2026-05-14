import { TestEntity } from '../entities';
import { TestType } from '../enums';

export interface ITestRepository {
  findById(id: string): Promise<TestEntity | null>;
  findByIdWithScales(
    id: string,
  ): Promise<(TestEntity & { scales: unknown[] }) | null>;
  findByIdWithQuestions(
    id: string,
  ): Promise<(TestEntity & { questions: unknown[] }) | null>;
  findAll(filters?: {
    type?: TestType;
    isActive?: boolean;
  }): Promise<TestEntity[]>;
  create(test: Partial<TestEntity>): Promise<TestEntity>;
  update(id: string, data: Partial<TestEntity>): Promise<TestEntity>;
  delete(id: string): Promise<void>;
}

export const TEST_REPOSITORY = Symbol('TEST_REPOSITORY');
