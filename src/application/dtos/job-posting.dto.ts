import {
  IsString,
  IsEmail,
  IsInt,
  IsArray,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  MinLength,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FilterQuestionDto {
  @IsInt()
  @Min(1)
  @Max(2)
  order: number;

  @IsString()
  @MinLength(3)
  questionText: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options: string[];

  @IsString()
  correctOption: string;
}

export class CreateJobPostingDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  topCandidatesCount: number;

  @IsEmail()
  responsibleEmail: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => FilterQuestionDto)
  questions: FilterQuestionDto[];
}

export class UpdateJobPostingStatusDto {
  @IsEnum(['ACTIVE', 'CLOSED', 'ARCHIVED'])
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
}

export class SendCredentialsBulkDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  topN?: number; // si no se envia, usa topCandidatesCount

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicationIds?: string[]; // si se envian, manda solo a esos (override)
}
