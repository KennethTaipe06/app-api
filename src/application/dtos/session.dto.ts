import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class StartSessionDto {
  @IsString()
  testId: string;

  @IsOptional()
  @IsString()
  candidateId?: string;

  @IsOptional()
  @IsString()
  examinerId?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class SubmitAnswerDto {
  @IsString()
  questionId: string;

  @IsNumber()
  questionNumber: number;

  @IsObject()
  response: Record<string, unknown>;

  @IsNumber()
  responseTimeMs: number;
}

export class BatchAnswerDto {
  @IsString()
  questionId: string;

  @IsNumber()
  questionNumber: number;

  @IsObject()
  response: Record<string, unknown>;

  @IsNumber()
  responseTimeMs: number;
}

export class FinishSessionDto {
  @IsString()
  sessionId: string;
}
