import { Inject, Injectable } from '@nestjs/common';
import type { ICustomQuestionRepository } from '../../../domain/repositories';
import { CUSTOM_QUESTION_REPOSITORY } from '../../../domain/repositories';
import { CreateCustomQuestionDto } from '../../dtos';
import { validateQuestionOptions } from './validators';

@Injectable()
export class CreateCustomQuestionUseCase {
  constructor(
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly repo: ICustomQuestionRepository,
  ) {}

  async execute(dto: CreateCustomQuestionDto, examinerId: string) {
    validateQuestionOptions(dto.type, dto.options);

    return this.repo.create(
      {
        examinerId,
        statement: dto.statement,
        type: dto.type,
        points: dto.points,
        explanation: dto.explanation ?? null,
        isActive: true,
      },
      dto.options.map((o, idx) => ({
        text: o.text,
        isCorrect: o.isCorrect,
        displayOrder: idx + 1,
      })),
    );
  }
}
