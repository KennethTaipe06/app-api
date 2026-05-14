export class AnswerEntity {
  id: string;
  sessionId: string;
  questionId: string;
  questionNumber: number;
  response: Record<string, unknown>;
  responseTimeMs: number;
  answeredAt: Date;
}
