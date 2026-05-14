import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AlertType } from '../../domain/enums';

export class CreateAlertDto {
  @IsUUID()
  sessionId: string;

  @IsEnum(AlertType)
  type: AlertType;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;

  // Limite ~7MB de base64 (~5MB de imagen). El use-case lo recorta tambien,
  // pero validar en el DTO evita parsear payloads enormes.
  @IsString()
  @IsOptional()
  @MaxLength(7_340_032)
  screenshotBase64?: string;
}
