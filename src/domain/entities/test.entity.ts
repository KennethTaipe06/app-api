import { TestType, QuestionFormat } from '../enums';

export class TestEntity {
  id: string;
  name: string;
  description: string | null;
  type: TestType;
  questionFormat: QuestionFormat;
  timeLimitMin: number;
  isActive: boolean;
  instructions: string | null;
  totalQuestions: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;

  isTimedOut(startedAt: Date): boolean {
    const elapsed = (Date.now() - startedAt.getTime()) / 1000 / 60;
    return elapsed >= this.timeLimitMin;
  }
}
