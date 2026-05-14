import { RecordingType } from '../enums/recording-type.enum';

export class RecordingEntity {
  id: string;
  sessionId: string;
  type: RecordingType;
  url: string;
  durationSec: number | null;
  sizeBytes: bigint | null;
  createdAt: Date;
}
