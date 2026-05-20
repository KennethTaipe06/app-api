import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ICustomExamRepository,
  ICustomExamSessionRepository,
  ICustomQuestionRepository,
  IUserRepository,
} from '../../../domain/repositories';
import {
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_EXAM_SESSION_REPOSITORY,
  CUSTOM_QUESTION_REPOSITORY,
  USER_REPOSITORY,
} from '../../../domain/repositories';
import { AssignCandidatesDto } from '../../dtos';
import { CustomSessionStatus, Role } from '../../../domain/enums';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class AssignCandidatesUseCase {
  constructor(
    @Inject(CUSTOM_EXAM_REPOSITORY)
    private readonly examRepo: ICustomExamRepository,
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly questionRepo: ICustomQuestionRepository,
    @Inject(CUSTOM_EXAM_SESSION_REPOSITORY)
    private readonly sessionRepo: ICustomExamSessionRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    examId: string,
    dto: AssignCandidatesDto,
    examinerId: string,
  ): Promise<{ assigned: number; skipped: number }> {
    const exam = await this.examRepo.findByIdWithQuestions(examId);
    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (exam.examinerId !== examinerId) {
      throw new ForbiddenException('Este examen no es tuyo');
    }
    if (!exam.isActive) {
      throw new BadRequestException('El examen esta inactivo');
    }
    if (!exam.examQuestions.length) {
      throw new BadRequestException('El examen no tiene preguntas');
    }

    const baseQuestionIds = exam.examQuestions
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((q) => q.questionId);

    // Traer opciones de cada pregunta para randomizar
    const questions = await this.questionRepo.findManyByIdsWithOptions(
      baseQuestionIds,
    );
    const optionsByQuestion = new Map<string, string[]>();
    for (const q of questions) {
      optionsByQuestion.set(
        q.id,
        q.options.map((o) => o.id),
      );
    }

    let assigned = 0;
    let skipped = 0;

    for (const candidateId of dto.candidateIds) {
      const candidate = await this.userRepo.findById(candidateId);
      if (!candidate || candidate.role !== Role.CANDIDATE) {
        skipped++;
        continue;
      }

      // Saltar si ya tiene sesion para este examen
      const existing = await this.sessionRepo.findByExamAndCandidate(
        examId,
        candidateId,
      );
      if (existing) {
        skipped++;
        continue;
      }

      // Randomizacion server-side: persiste el orden de preguntas y opciones
      const questionOrder = exam.randomizeQuestions
        ? shuffle(baseQuestionIds)
        : [...baseQuestionIds];

      const optionOrders: Record<string, string[]> = {};
      for (const qid of questionOrder) {
        const opts = optionsByQuestion.get(qid) ?? [];
        optionOrders[qid] = exam.randomizeOptions ? shuffle(opts) : [...opts];
      }

      await this.sessionRepo.create({
        examId,
        candidateId,
        status: CustomSessionStatus.PENDING,
        currentQuestionIndex: 0,
        totalQuestions: questionOrder.length,
        questionOrder,
        optionOrders,
      });
      assigned++;
    }

    return { assigned, skipped };
  }
}
