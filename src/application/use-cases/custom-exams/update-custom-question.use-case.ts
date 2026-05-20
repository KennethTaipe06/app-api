import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ICustomQuestionRepository } from '../../../domain/repositories';
import { CUSTOM_QUESTION_REPOSITORY } from '../../../domain/repositories';
import { UpdateCustomQuestionDto } from '../../dtos';
import { validateQuestionOptions } from './validators';

@Injectable()
export class UpdateCustomQuestionUseCase {
  constructor(
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly repo: ICustomQuestionRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateCustomQuestionDto,
    examinerId: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Pregunta no encontrada');
    if (existing.examinerId !== examinerId) {
      throw new ForbiddenException('Esta pregunta no es tuya');
    }

    const type = dto.type ?? existing.type;
    if (dto.options) {
      validateQuestionOptions(type, dto.options);
    }

    return this.repo.update(
      id,
      {
        statement: dto.statement ?? undefined,
        type: dto.type ?? undefined,
        points: dto.points ?? undefined,
        explanation: dto.explanation ?? undefined,
      },
      dto.options
        ? dto.options.map((o, idx) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            displayOrder: idx + 1,
          }))
        : undefined,
    );
  }
}
