import { CustomAnswerEntity } from '../entities';

export interface ICustomAnswerRepository {
  findBySession(sessionId: string): Promise<CustomAnswerEntity[]>;
  findBySessionAndQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<CustomAnswerEntity | null>;
  create(data: Partial<CustomAnswerEntity>): Promise<CustomAnswerEntity>;
}

export const CUSTOM_ANSWER_REPOSITORY = Symbol('CUSTOM_ANSWER_REPOSITORY');
