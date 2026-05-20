import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ICustomAnswerRepository,
  ICustomExamRepository,
  ICustomExamSessionRepository,
  ICustomQuestionRepository,
} from '../../../domain/repositories';
import {
  CUSTOM_ANSWER_REPOSITORY,
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_EXAM_SESSION_REPOSITORY,
  CUSTOM_QUESTION_REPOSITORY,
} from '../../../domain/repositories';
import { CustomSessionStatus } from '../../../domain/enums';

@Injectable()
export class FinishCustomExamUseCase {
  constructor(
    @Inject(CUSTOM_EXAM_SESSION_REPOSITORY)
    private readonly sessionRepo: ICustomExamSessionRepository,
    @Inject(CUSTOM_EXAM_REPOSITORY)
    private readonly examRepo: ICustomExamRepository,
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly questionRepo: ICustomQuestionRepository,
    @Inject(CUSTOM_ANSWER_REPOSITORY)
    private readonly answerRepo: ICustomAnswerRepository,
  ) {}

  async execute(
    sessionId: string,
    candidateId: string,
    opts?: { forceStatus?: CustomSessionStatus },
  ) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundException('Sesion no encontrada');
    if (session.candidateId !== candidateId) {
      throw new ForbiddenException('Esta sesion no es tuya');
    }

    // Idempotente
    if (session.isFinished()) {
      return session;
    }

    const exam = await this.examRepo.findById(session.examId);
    if (!exam) throw new NotFoundException('Examen no encontrado');

    // Calcular score basado en answers persistidas
    const answers = await this.answerRepo.findBySession(session.id);
    const questions = await this.questionRepo.findManyByIdsWithOptions(
      session.questionOrder,
    );
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    const rawScore = answers.reduce((sum, a) => sum + a.pointsAwarded, 0);
    const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
    const passed =
      exam.passingScore !== null ? percentage >= exam.passingScore : null;

    const status = opts?.forceStatus ?? CustomSessionStatus.COMPLETED;
    const now = new Date();
    const timeSpentSec = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : null;

    return this.sessionRepo.update(session.id, {
      status,
      finishedAt: now,
      timeSpentSec,
      rawScore,
      maxScore,
      percentage: Math.round(percentage * 100) / 100,
      passed,
    });
  }
}
