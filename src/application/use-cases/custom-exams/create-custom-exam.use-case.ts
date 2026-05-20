import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  ICustomExamRepository,
  ICustomQuestionRepository,
} from '../../../domain/repositories';
import {
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_QUESTION_REPOSITORY,
} from '../../../domain/repositories';
import { CreateCustomExamDto } from '../../dtos';

@Injectable()
export class CreateCustomExamUseCase {
  constructor(
    @Inject(CUSTOM_EXAM_REPOSITORY)
    private readonly examRepo: ICustomExamRepository,
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly questionRepo: ICustomQuestionRepository,
  ) {}

  async execute(dto: CreateCustomExamDto, examinerId: string) {
    // Verificar que todas las preguntas existen y pertenecen al examiner
    const questions = await this.questionRepo.findManyByIdsWithOptions(
      dto.questionIds,
    );
    if (questions.length !== dto.questionIds.length) {
      throw new BadRequestException(
        'Algunas preguntas no existen en el banco',
      );
    }
    const foreign = questions.find((q) => q.examinerId !== examinerId);
    if (foreign) {
      throw new ForbiddenException(
        'Solo puedes usar preguntas de tu propio banco',
      );
    }

    return this.examRepo.create(
      {
        examinerId,
        title: dto.title,
        description: dto.description ?? null,
        instructions: dto.instructions ?? null,
        durationMin: dto.durationMin,
        passingScore: dto.passingScore ?? null,
        randomizeQuestions: dto.randomizeQuestions ?? true,
        randomizeOptions: dto.randomizeOptions ?? true,
        isActive: true,
      },
      dto.questionIds,
    );
  }
}
