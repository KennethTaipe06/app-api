import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { TestType, QuestionFormat } from '../../domain/enums';

export class CreateTestDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TestType)
  type: TestType;

  @IsEnum(QuestionFormat)
  questionFormat: QuestionFormat;

  @IsNumber()
  @Min(1)
  timeLimitMin: number;

  @IsNumber()
  @Min(1)
  totalQuestions: number;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class UpdateTestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  timeLimitMin?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  totalQuestions?: number;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
