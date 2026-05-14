import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type {
  ISessionRepository,
  ITestRepository,
  IUserRepository,
} from '../../../domain/repositories';
import {
  SESSION_REPOSITORY,
  TEST_REPOSITORY,
  USER_REPOSITORY,
} from '../../../domain/repositories';
import { StartSessionDto } from '../../dtos';
import { ExamSessionEntity } from '../../../domain/entities';
import { SessionStatus } from '../../../domain/enums';

@Injectable()
export class StartExamUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(TEST_REPOSITORY)
    private readonly testRepository: ITestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: StartSessionDto): Promise<ExamSessionEntity> {
    const test = await this.testRepository.findById(dto.testId);
    if (!test) {
      throw new NotFoundException('Test no encontrado');
    }

    if (!test.isActive) {
      throw new BadRequestException('Este test no esta activo');
    }

    const candidate = await this.userRepository.findById(dto.candidateId!);
    if (!candidate) {
      throw new NotFoundException('Candidato no encontrado');
    }

    if (!candidate.canTakeExam()) {
      throw new BadRequestException('El usuario no puede tomar examenes');
    }

    // Verificar que no tenga una sesion activa para este test
    const existingSessions = await this.sessionRepository.findByCandidate(
      dto.candidateId!,
    );
    const activeSession = existingSessions.find(
      (s) => s.testId === dto.testId && s.status === SessionStatus.IN_PROGRESS,
    );
    if (activeSession) {
      throw new BadRequestException(
        'Ya tiene una sesion activa para este test',
      );
    }

    return this.sessionRepository.create({
      testId: dto.testId,
      candidateId: dto.candidateId,
      examinerId: dto.examinerId || null,
      status: SessionStatus.IN_PROGRESS,
      startedAt: new Date(),
      ipAddress: dto.ipAddress || null,
      userAgent: dto.userAgent || null,
      currentQuestion: 1,
    });
  }
}
