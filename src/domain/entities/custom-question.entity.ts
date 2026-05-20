import { CustomQuestionType } from '../enums';

export class CustomQuestionEntity {
  id: string;
  examinerId: string;
  statement: string;
  type: CustomQuestionType;
  points: number;
  explanation: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomQuestionOptionEntity {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  displayOrder: number;
}
