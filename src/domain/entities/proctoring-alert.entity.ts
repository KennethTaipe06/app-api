import { AlertType } from '../enums';

export class ProctoringAlertEntity {
  id: string;
  sessionId: string | null;
  customSessionId: string | null;
  type: AlertType;
  data: Record<string, unknown> | null;
  screenshotUrl: string | null;
  createdAt: Date;
}
