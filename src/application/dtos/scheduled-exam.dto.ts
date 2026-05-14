import {
  IsString,
  IsDateString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { TestType } from '../../domain/enums';

export class CreateScheduledExamDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  scheduledAt: string; // ISO 8601 — hora de inicio

  @IsNumber()
  @Min(1)
  @IsOptional()
  durationMin?: number; // defaults to 120 (2 horas para bateria completa)

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  candidateIds: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TestType, { each: true })
  @IsOptional()
  testTypes?: TestType[]; // Si no se indica, se usan los 4 tests de la bateria
}

export class UpdateScheduledExamDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  durationMin?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  candidateIds?: string[];
}
