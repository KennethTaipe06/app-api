import { RecordingEntity } from '../entities/recording.entity';

export interface IRecordingRepository {
  create(data: Partial<RecordingEntity>): Promise<RecordingEntity>;
  findBySessionId(sessionId: string): Promise<RecordingEntity[]>;
  findById(id: string): Promise<RecordingEntity | null>;
  findBySessionAndUrl(
    sessionId: string,
    url: string,
  ): Promise<RecordingEntity | null>;
}

export const RECORDING_REPOSITORY = Symbol('RECORDING_REPOSITORY');
