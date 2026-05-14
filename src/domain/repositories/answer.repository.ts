import { AnswerEntity } from '../entities';

export interface IAnswerRepository {
  findBySession(sessionId: string): Promise<AnswerEntity[]>;
  create(answer: Partial<AnswerEntity>): Promise<AnswerEntity>;
  createMany(answers: Partial<AnswerEntity>[]): Promise<number>;
}

export const ANSWER_REPOSITORY = Symbol('ANSWER_REPOSITORY');
