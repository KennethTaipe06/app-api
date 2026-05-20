import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ICustomExamSessionRepository } from '../../../domain/repositories';
import { CUSTOM_EXAM_SESSION_REPOSITORY } from '../../../domain/repositories';
import { CustomSessionStatus } from '../../../domain/enums';

@Injectable()
export class StartCustomExamUseCase {
  constructor(
    @Inject(CUSTOM_EXAM_SESSION_REPOSITORY)
    private readonly sessionRepo: ICustomExamSessionRepository,
  ) {}

  async execute(
    sessionId: string,
    candidateId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundException('Sesion no encontrada');
    if (session.candidateId !== candidateId) {
      throw new ForbiddenException('Esta sesion no es tuya');
    }

    if (session.status === CustomSessionStatus.IN_PROGRESS) {
      // Idempotente: ya iniciada
      return session;
    }
    if (session.status !== CustomSessionStatus.PENDING) {
      throw new BadRequestException(
        `No se puede iniciar (estado: ${session.status})`,
      );
    }

    return this.sessionRepo.update(sessionId, {
      status: CustomSessionStatus.IN_PROGRESS,
      startedAt: new Date(),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    });
  }
}
