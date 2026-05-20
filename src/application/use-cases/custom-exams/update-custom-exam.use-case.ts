import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ICustomExamRepository,
  ICustomQuestionRepository,
} from '../../../domain/repositories';
import {
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_QUESTION_REPOSITORY,
} from '../../../domain/repositories';
import { UpdateCustomExamDto } from '../../dtos';

@Injectable()
export class UpdateCustomExamUseCase {
  constructor(
    @Inject(CUSTOM_EXAM_REPOSITORY)
    private readonly examRepo: ICustomExamRepository,
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly questionRepo: ICustomQuestionRepository,
  ) {}

  async execute(id: string, dto: UpdateCustomExamDto, examinerId: string) {
    const existing = await this.examRepo.findById(id);
    if (!existing) throw new NotFoundException('Examen no encontrado');
    if (existing.examinerId !== examinerId) {
      throw new ForbiddenException('Este examen no es tuyo');
    }

    if (dto.questionIds) {
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
    }

    return this.examRepo.update(
      id,
      {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        instructions: dto.instructions ?? undefined,
        durationMin: dto.durationMin ?? undefined,
        passingScore: dto.passingScore ?? undefined,
        randomizeQuestions: dto.randomizeQuestions ?? undefined,
        randomizeOptions: dto.randomizeOptions ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
      dto.questionIds,
    );
  }
}
