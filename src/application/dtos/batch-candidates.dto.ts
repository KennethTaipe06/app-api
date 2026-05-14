import {
  IsArray,
  IsEmail,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchCandidateItemDto {
  @IsEmail()
  email: string;

  @IsString()
  cedula: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;
}

export class BatchCreateCandidatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchCandidateItemDto)
  candidates: BatchCandidateItemDto[];
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
