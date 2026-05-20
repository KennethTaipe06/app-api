import { CustomExamSessionEntity } from '../entities';
import { CustomSessionStatus } from '../enums';

export interface CustomSessionListItem extends CustomExamSessionEntity {
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
}

export interface ICustomExamSessionRepository {
  findById(id: string): Promise<CustomExamSessionEntity | null>;
  findByExamAndCandidate(
    examId: string,
    candidateId: string,
  ): Promise<CustomExamSessionEntity | null>;
  findByExam(examId: string): Promise<CustomSessionListItem[]>;
  findByCandidate(candidateId: string): Promise<CustomSessionListItem[]>;
  findGlobalRanking(
    examinerId: string,
    limit?: number,
  ): Promise<CustomSessionListItem[]>;
  create(
    data: Partial<CustomExamSessionEntity>,
  ): Promise<CustomExamSessionEntity>;
  createMany(
    data: Array<Partial<CustomExamSessionEntity>>,
  ): Promise<number>;
  update(
    id: string,
    data: Partial<CustomExamSessionEntity>,
  ): Promise<CustomExamSessionEntity>;
  updateStatus(
    id: string,
    status: CustomSessionStatus,
  ): Promise<CustomExamSessionEntity>;
}

export const CUSTOM_EXAM_SESSION_REPOSITORY = Symbol(
  'CUSTOM_EXAM_SESSION_REPOSITORY',
);
