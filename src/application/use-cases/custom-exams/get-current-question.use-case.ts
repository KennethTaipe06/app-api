import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ICustomExamRepository,
  ICustomExamSessionRepository,
  ICustomQuestionRepository,
} from '../../../domain/repositories';
import {
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_EXAM_SESSION_REPOSITORY,
  CUSTOM_QUESTION_REPOSITORY,
} from '../../../domain/repositories';
import { CustomSessionStatus, CustomQuestionType } from '../../../domain/enums';

/**
 * Devuelve SOLO la pregunta en `currentQuestionIndex` de la sesion.
 * Las opciones se entregan SIN el campo `isCorrect` (seguridad anticopia).
 * El servidor es el unico que conoce las respuestas correctas.
 */
@Injectable()
export class GetCurrentQuestionUseCase {
  constructor(
    @Inject(CUSTOM_EXAM_SESSION_REPOSITORY)
    private readonly sessionRepo: ICustomExamSessionRepository,
    @Inject(CUSTOM_EXAM_REPOSITORY)
    private readonly examRepo: ICustomExamRepository,
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly questionRepo: ICustomQuestionRepository,
  ) {}

  async execute(sessionId: string, candidateId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundException('Sesion no encontrada');
    if (session.candidateId !== candidateId) {
      throw new ForbiddenException('Esta sesion no es tuya');
    }
    if (session.status !== CustomSessionStatus.IN_PROGRESS) {
      return {
        finished: true,
        status: session.status,
        currentIndex: session.currentQuestionIndex,
        total: session.totalQuestions,
      };
    }

    // Si llegamos al final, indicar que termino
    if (session.currentQuestionIndex >= session.totalQuestions) {
      return {
        finished: true,
        status: session.status,
        currentIndex: session.currentQuestionIndex,
        total: session.totalQuestions,
      };
    }

    const exam = await this.examRepo.findById(session.examId);
    if (!exam) throw new NotFoundException('Examen no encontrado');

    const questionId = session.questionOrder[session.currentQuestionIndex];
    const question = await this.questionRepo.findByIdWithOptions(questionId);
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    const orderedOptionIds = session.optionOrders[questionId] ?? [];
    const orderedOptions = orderedOptionIds
      .map((oid) => question.options.find((o) => o.id === oid))
      .filter(Boolean) as typeof question.options;

    // Calcular deadline (server-side) para que el cliente no pueda alterar el tiempo
    let deadlineAt: string | null = null;
    if (session.startedAt) {
      const deadline = new Date(
        session.startedAt.getTime() + exam.durationMin * 60_000,
      );
      deadlineAt = deadline.toISOString();
    }

    return {
      finished: false,
      currentIndex: session.currentQuestionIndex,
      total: session.totalQuestions,
      deadlineAt,
      examTitle: exam.title,
      question: {
        id: question.id,
        statement: question.statement,
        type: question.type,
        points: question.points,
        // NUNCA enviar isCorrect ni explanation
        allowMultiple: question.type === CustomQuestionType.MULTIPLE_CHOICE_MULTI,
        options: orderedOptions.map((o) => ({
          id: o.id,
          text: o.text,
        })),
      },
    };
  }
}
