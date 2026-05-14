export class ResultEntity {
  id: string;
  sessionId: string;
  totalScore: number | null;
  interpretation: string | null;
  rawData: Record<string, unknown> | null;
  calculatedAt: Date;
}

export class ScaleResultEntity {
  id: string;
  resultId: string;
  scaleId: string;
  rawScore: number;
  percentile: number | null;
  stenScore: number | null;
  category: string | null;
}
