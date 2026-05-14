import { ProctoringAlertEntity } from '../entities/proctoring-alert.entity';

export interface IProctoringAlertRepository {
  create(data: Partial<ProctoringAlertEntity>): Promise<ProctoringAlertEntity>;
  findBySessionId(sessionId: string): Promise<ProctoringAlertEntity[]>;
  countBySessionId(sessionId: string): Promise<number>;
  findRecent(limit: number): Promise<ProctoringAlertEntity[]>;
}

export const PROCTORING_ALERT_REPOSITORY = Symbol(
  'PROCTORING_ALERT_REPOSITORY',
);
