import {
  BadRequestException,
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
import { SubmitCustomAnswerDto } from '../../dtos';
import { CustomQuestionType, CustomSessionStatus } from '../../../domain/enums';

/**
 * Califica la respuesta del candidato en el servidor y avanza el indice.
 * Reglas:
 * - Solo se acepta respuesta para la pregunta en currentQuestionIndex (no se puede saltar/regresar)
 * - Idempotente: si ya respondio, retorna el resultado anterior sin volver a calificar
 * - Si el tiempo del examen expiro, se marca EXPIRED y no se acepta la respuesta
 */
@Injectable()
export class SubmitCustomAnswerUseCase {
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
    dto: SubmitCustomAnswerDto,
  ) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundException('Sesion no encontrada');
    if (session.candidateId !== candidateId) {
      throw new ForbiddenException('Esta sesion no es tuya');
    }
    if (session.status !== CustomSessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Sesion no activa (estado: ${session.status})`,
      );
    }

    const exam = await this.examRepo.findById(session.examId);
    if (!exam) throw new NotFoundException('Examen no encontrado');

    // Verificar tiempo
    if (session.startedAt && exam.isTimedOut(session.startedAt)) {
      await this.finalizeSession(session.id, CustomSessionStatus.EXPIRED);
      throw new BadRequestException('Tiempo del examen agotado');
    }

    // Solo se puede responder la pregunta actual
    const expectedQuestionId =
      session.questionOrder[session.currentQuestionIndex];
    if (!expectedQuestionId) {
      throw new BadRequestException('No hay pregunta pendiente');
    }
    if (dto.questionId !== expectedQuestionId) {
      throw new BadRequestException(
        'La pregunta enviada no corresponde a la actual',
      );
    }

    // Idempotencia: si ya existe, devolverla
    const existing = await this.answerRepo.findBySessionAndQuestion(
      session.id,
      dto.questionId,
    );
    if (existing) {
      return {
        accepted: true,
        nextIndex: session.currentQuestionIndex,
        finished: session.currentQuestionIndex >= session.totalQuestions,
      };
    }

    const question = await this.questionRepo.findByIdWithOptions(dto.questionId);
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    // Validar que las opciones seleccionadas pertenecen a la pregunta
    const validOptionIds = new Set(question.options.map((o) => o.id));
    for (const oid of dto.selectedOptionIds) {
      if (!validOptionIds.has(oid)) {
        throw new BadRequestException(
          'Opcion seleccionada no pertenece a la pregunta',
        );
      }
    }

    // Para SINGLE / TRUE_FALSE, solo una opcion permitida
    if (
      (question.type === CustomQuestionType.MULTIPLE_CHOICE_SINGLE ||
        question.type === CustomQuestionType.TRUE_FALSE) &&
      dto.selectedOptionIds.length !== 1
    ) {
      throw new BadRequestException(
        'Esta pregunta admite exactamente 1 opcion',
      );
    }

    // Calificar
    const correctIds = new Set(
      question.options.filter((o) => o.isCorrect).map((o) => o.id),
    );
    const selectedIds = new Set(dto.selectedOptionIds);

    let isCorrect = false;
    if (
      question.type === CustomQuestionType.MULTIPLE_CHOICE_SINGLE ||
      question.type === CustomQuestionType.TRUE_FALSE
    ) {
      isCorrect =
        selectedIds.size === 1 &&
        correctIds.has(dto.selectedOptionIds[0]);
    } else {
      // MULTIPLE: todas las correctas, ninguna incorrecta
      isCorrect =
        selectedIds.size === correctIds.size &&
        [...selectedIds].every((id) => correctIds.has(id));
    }

    const pointsAwarded = isCorrect ? question.points : 0;

    await this.answerRepo.create({
      sessionId: session.id,
      questionId: dto.questionId,
      selectedOptionIds: dto.selectedOptionIds,
      isCorrect,
      pointsAwarded,
      responseTimeMs: dto.responseTimeMs ?? null,
    });

    const nextIndex = session.currentQuestionIndex + 1;
    await this.sessionRepo.update(session.id, {
      currentQuestionIndex: nextIndex,
    });

    return {
      accepted: true,
      // NO devolver isCorrect ni puntos (anti-copia: el candidato no debe
      // saber si acerto en tiempo real)
      nextIndex,
      finished: nextIndex >= session.totalQuestions,
    };
  }

  private async finalizeSession(
    sessionId: string,
    status: CustomSessionStatus,
  ) {
    await this.sessionRepo.update(sessionId, {
      status,
      finishedAt: new Date(),
    });
  }
}
