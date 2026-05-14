import { Inject, Injectable } from '@nestjs/common';
import type { ITestRepository } from '../../../domain/repositories';
import { TEST_REPOSITORY } from '../../../domain/repositories';
import { CreateTestDto } from '../../dtos';
import { TestEntity } from '../../../domain/entities';

@Injectable()
export class CreateTestUseCase {
  constructor(
    @Inject(TEST_REPOSITORY)
    private readonly testRepository: ITestRepository,
  ) {}

  async execute(dto: CreateTestDto, createdById: string): Promise<TestEntity> {
    return this.testRepository.create({
      ...dto,
      createdById,
      isActive: true,
    } as Partial<TestEntity>);
  }
}
