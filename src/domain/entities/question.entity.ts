export class QuestionEntity {
  id: string;
  testId: string;
  number: number;
  text: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  options: Record<string, unknown> | null;
  scoring: Record<string, unknown>;
}
