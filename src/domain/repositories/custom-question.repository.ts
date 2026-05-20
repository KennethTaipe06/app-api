import {
  CustomQuestionEntity,
  CustomQuestionOptionEntity,
} from '../entities';

export interface CustomQuestionWithOptions extends CustomQuestionEntity {
  options: CustomQuestionOptionEntity[];
}

export interface ICustomQuestionRepository {
  findById(id: string): Promise<CustomQuestionEntity | null>;
  findByIdWithOptions(id: string): Promise<CustomQuestionWithOptions | null>;
  findManyByIdsWithOptions(
    ids: string[],
  ): Promise<CustomQuestionWithOptions[]>;
  findByExaminer(
    examinerId: string,
    filters?: { isActive?: boolean; search?: string },
  ): Promise<CustomQuestionWithOptions[]>;
  create(
    data: Partial<CustomQuestionEntity>,
    options: Array<Omit<CustomQuestionOptionEntity, 'id' | 'questionId'>>,
  ): Promise<CustomQuestionWithOptions>;
  update(
    id: string,
    data: Partial<CustomQuestionEntity>,
    options?: Array<Omit<CustomQuestionOptionEntity, 'id' | 'questionId'>>,
  ): Promise<CustomQuestionWithOptions>;
  delete(id: string): Promise<void>;
  countUsageInExams(id: string): Promise<number>;
}

export const CUSTOM_QUESTION_REPOSITORY = Symbol('CUSTOM_QUESTION_REPOSITORY');
