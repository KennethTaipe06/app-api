import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveRecordingDto {
  @IsString()
  sessionId: string;

  @IsString()
  @IsEnum(['WEBCAM', 'SCREEN'])
  type: string;

  @IsNumber()
  @IsOptional()
  durationSec?: number;
}

export class InitMinioMultipartDto {
  @IsString()
  sessionId: string;

  @IsEnum(['WEBCAM'])
  type: 'WEBCAM';

  @IsString()
  contentType: string;
}

export class GetMinioPartUrlDto {
  @IsString()
  sessionId: string;

  @IsString()
  uploadId: string;

  @IsString()
  objectKey: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber: number;

  @IsString()
  contentType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;
}

export class MultipartCompletedPartDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  partNumber: number;

  @IsOptional()
  @IsString()
  etag?: string;

  @IsOptional()
  @IsString()
  ETag?: string;
}

export class CompleteMinioMultipartDto {
  @IsString()
  sessionId: string;

  @IsString()
  uploadId: string;

  @IsString()
  objectKey: string;

  @IsEnum(['WEBCAM'])
  type: 'WEBCAM';

  @IsString()
  contentType: string;

  @IsNumber()
  @Min(0)
  durationSec: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MultipartCompletedPartDto)
  parts: MultipartCompletedPartDto[];
}

export class AbortMinioMultipartDto {
  @IsString()
  sessionId: string;

  @IsString()
  uploadId: string;

  @IsString()
  objectKey: string;
}
