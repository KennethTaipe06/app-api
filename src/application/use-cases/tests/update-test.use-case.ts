import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITestRepository } from '../../../domain/repositories';
import { TEST_REPOSITORY } from '../../../domain/repositories';
import { UpdateTestDto } from '../../dtos';
import { TestEntity } from '../../../domain/entities';

@Injectable()
export class UpdateTestUseCase {
  constructor(
    @Inject(TEST_REPOSITORY)
    private readonly testRepository: ITestRepository,
  ) {}

  async execute(id: string, dto: UpdateTestDto): Promise<TestEntity> {
    const test = await this.testRepository.findById(id);
    if (!test) {
      throw new NotFoundException('Test no encontrado');
    }
    return this.testRepository.update(id, dto as Partial<TestEntity>);
  }
}
