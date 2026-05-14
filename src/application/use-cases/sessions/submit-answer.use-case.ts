import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type {
  ISessionRepository,
  IAnswerRepository,
} from '../../../domain/repositories';
import {
  SESSION_REPOSITORY,
  ANSWER_REPOSITORY,
} from '../../../domain/repositories';
import { SubmitAnswerDto } from '../../dtos';
import { AnswerEntity } from '../../../domain/entities';

@Injectable()
export class SubmitAnswerUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(ANSWER_REPOSITORY)
    private readonly answerRepository: IAnswerRepository,
  ) {}

  async execute(
    sessionId: string,
    dto: SubmitAnswerDto,
  ): Promise<AnswerEntity> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Sesion no encontrada');
    }

    if (!session.isActive()) {
      throw new BadRequestException('La sesion no esta activa');
    }

    let answer: AnswerEntity;
    try {
      answer = await this.answerRepository.create({
        sessionId,
        questionId: dto.questionId,
        questionNumber: dto.questionNumber,
        response: dto.response,
        responseTimeMs: dto.responseTimeMs,
      });
    } catch (err: any) {
      // Si la respuesta ya existe (unique constraint), es un reenvio - ignorar
      if (err?.code === 'P2002') {
        // Actualizar pregunta actual y continuar sin error
        await this.sessionRepository.update(sessionId, {
          currentQuestion: dto.questionNumber + 1,
        });
        return { sessionId, questionId: dto.questionId } as any;
      }
      throw err;
    }

    // Actualizar la pregunta actual de la sesion
    await this.sessionRepository.update(sessionId, {
      currentQuestion: dto.questionNumber + 1,
    });

    return answer;
  }
}
