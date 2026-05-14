import { ResultEntity, ScaleResultEntity } from '../entities';

export interface IResultRepository {
  findBySession(sessionId: string): Promise<ResultEntity | null>;
  findBySessionWithScales(
    sessionId: string,
  ): Promise<(ResultEntity & { scaleResults: ScaleResultEntity[] }) | null>;
  create(
    result: Partial<ResultEntity>,
    scaleResults: Partial<ScaleResultEntity>[],
  ): Promise<ResultEntity>;
}

export const RESULT_REPOSITORY = Symbol('RESULT_REPOSITORY');
