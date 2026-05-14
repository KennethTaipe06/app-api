import { ExamSessionEntity } from '../entities';
import { SessionStatus } from '../enums';

export interface ISessionRepository {
  findById(id: string): Promise<ExamSessionEntity | null>;
  findByIdWithRelations(id: string): Promise<ExamSessionEntity | null>;
  findByCandidate(candidateId: string): Promise<ExamSessionEntity[]>;
  findActive(): Promise<ExamSessionEntity[]>;
  findAll(filters?: {
    status?: SessionStatus;
    testId?: string;
  }): Promise<ExamSessionEntity[]>;
  create(session: Partial<ExamSessionEntity>): Promise<ExamSessionEntity>;
  update(
    id: string,
    data: Partial<ExamSessionEntity>,
  ): Promise<ExamSessionEntity>;
  findIdsByScheduledExam(
    scheduledExamId: string,
    candidateId: string,
  ): Promise<string[]>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
