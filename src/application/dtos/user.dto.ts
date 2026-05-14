import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsEmail,
  MinLength,
} from 'class-validator';
import { Role } from '../../domain/enums';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  cedula: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(Role)
  role: Role;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}
