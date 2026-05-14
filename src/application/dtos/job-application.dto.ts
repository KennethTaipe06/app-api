import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  MinLength,
  ValidateNested,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AcademicTitleDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  @IsOptional()
  year?: number;

  @IsEnum([
    'BACHILLERATO',
    'TECNICO',
    'TECNOLOGICO',
    'PREGRADO',
    'POSTGRADO',
    'MAESTRIA',
    'DOCTORADO',
    'OTRO',
  ])
  @IsOptional()
  level?: string;
}

export class ExperienceDto {
  @IsString()
  @MinLength(1)
  company: string;

  @IsString()
  @MinLength(1)
  position: string;

  @IsInt()
  @Min(0)
  @Max(720) // 60 anos en meses
  durationMonths: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class FilterAnswerDto {
  @IsString()
  questionId: string;

  @IsString()
  selectedOption: string;
}

export class SubmitApplicationDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  cedula: string;

  @IsDateString()
  birthDate: string;

  @IsString()
  @MinLength(2)
  residenceCity: string;

  @IsString()
  @MinLength(2)
  residenceProvince: string;

  @IsEmail()
  email: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AcademicTitleDto)
  academicTitles: AcademicTitleDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences: ExperienceDto[];

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => FilterAnswerDto)
  answers: FilterAnswerDto[];

  @IsString()
  @IsOptional()
  fingerprint?: string;
}
