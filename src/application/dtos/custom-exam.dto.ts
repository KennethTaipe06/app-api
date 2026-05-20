import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomQuestionType } from '../../domain/enums';

// ===== Banco de preguntas =====

export class CustomQuestionOptionDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateCustomQuestionDto {
  @IsString()
  @MinLength(1)
  statement: string;

  @IsEnum(CustomQuestionType)
  type: CustomQuestionType;

  @IsInt()
  @Min(1)
  @Max(100)
  points: number;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CustomQuestionOptionDto)
  options: CustomQuestionOptionDto[];
}

export class UpdateCustomQuestionDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  statement?: string;

  @IsEnum(CustomQuestionType)
  @IsOptional()
  type?: CustomQuestionType;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  points?: number;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CustomQuestionOptionDto)
  @IsOptional()
  options?: CustomQuestionOptionDto[];
}

// ===== Examenes =====

export class CreateCustomExamDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsInt()
  @Min(1)
  @Max(600)
  durationMin: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  passingScore?: number;

  @IsBoolean()
  @IsOptional()
  randomizeQuestions?: boolean;

  @IsBoolean()
  @IsOptional()
  randomizeOptions?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  questionIds: string[];
}

export class UpdateCustomExamDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsInt()
  @Min(1)
  @Max(600)
  @IsOptional()
  durationMin?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  passingScore?: number;

  @IsBoolean()
  @IsOptional()
  randomizeQuestions?: boolean;

  @IsBoolean()
  @IsOptional()
  randomizeOptions?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  @IsOptional()
  questionIds?: string[];
}

// ===== Asignacion =====

export class AssignCandidatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  candidateIds: string[];
}

// ===== Sesion (toma del examen) =====

export class SubmitCustomAnswerDto {
  @IsUUID()
  questionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  selectedOptionIds: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  responseTimeMs?: number;
}
