import { CustomSessionStatus } from '../enums';

export class CustomExamSessionEntity {
  id: string;
  examId: string;
  candidateId: string;
  status: CustomSessionStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  timeSpentSec: number | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  questionOrder: string[];               // questionIds en orden randomizado
  optionOrders: Record<string, string[]>; // questionId -> [optionIds]
  rawScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;

  isActive(): boolean {
    return this.status === CustomSessionStatus.IN_PROGRESS;
  }

  isFinished(): boolean {
    return [
      CustomSessionStatus.COMPLETED,
      CustomSessionStatus.EXPIRED,
      CustomSessionStatus.DISQUALIFIED,
      CustomSessionStatus.CANCELLED,
    ].includes(this.status);
  }
}
