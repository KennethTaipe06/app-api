import { SessionStatus } from '../enums';

export class ExamSessionEntity {
  id: string;
  testId: string;
  candidateId: string;
  examinerId: string | null;
  scheduledExamId: string | null;
  status: SessionStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  timeSpentSec: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  currentQuestion: number;
  createdAt: Date;
  updatedAt: Date;

  isActive(): boolean {
    return this.status === SessionStatus.IN_PROGRESS;
  }

  canResume(): boolean {
    return this.status === SessionStatus.PAUSED;
  }
}
