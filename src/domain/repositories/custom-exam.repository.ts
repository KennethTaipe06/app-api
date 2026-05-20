import { CustomExamEntity } from '../entities';

export interface CustomExamWithQuestions extends CustomExamEntity {
  examQuestions: Array<{
    id: string;
    questionId: string;
    displayOrder: number;
  }>;
}

export interface ICustomExamRepository {
  findById(id: string): Promise<CustomExamEntity | null>;
  findByIdWithQuestions(id: string): Promise<CustomExamWithQuestions | null>;
  findByExaminer(
    examinerId: string,
    filters?: { isActive?: boolean },
  ): Promise<CustomExamEntity[]>;
  create(
    data: Partial<CustomExamEntity>,
    questionIds: string[],
  ): Promise<CustomExamWithQuestions>;
  update(
    id: string,
    data: Partial<CustomExamEntity>,
    questionIds?: string[],
  ): Promise<CustomExamWithQuestions>;
  delete(id: string): Promise<void>;
}

export const CUSTOM_EXAM_REPOSITORY = Symbol('CUSTOM_EXAM_REPOSITORY');
