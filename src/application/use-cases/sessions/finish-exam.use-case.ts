import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { ISessionRepository } from '../../../domain/repositories';
import { SESSION_REPOSITORY } from '../../../domain/repositories';
import { SessionStatus } from '../../../domain/enums';
import { ExamSessionEntity } from '../../../domain/entities';

@Injectable()
export class FinishExamUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(sessionId: string): Promise<ExamSessionEntity> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Sesion no encontrada');
    }

    // Si ya esta completada, retornar sin error (idempotente)
    if (session.status === SessionStatus.COMPLETED) {
      return session;
    }

    if (!session.isActive()) {
      throw new BadRequestException('La sesion no esta activa');
    }

    const now = new Date();
    const timeSpentSec = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    return this.sessionRepository.update(sessionId, {
      status: SessionStatus.COMPLETED,
      finishedAt: now,
      timeSpentSec,
    });
  }
}
