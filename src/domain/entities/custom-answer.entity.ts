export class CustomAnswerEntity {
  id: string;
  sessionId: string;
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number | null;
  answeredAt: Date;
}
