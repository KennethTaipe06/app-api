import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import type { Role } from '../../domain/enums';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @Matches(/^[0-9A-Za-z-]{5,32}$/, {
    message: 'cedula debe ser alfanumerica entre 5 y 32 caracteres',
  })
  cedula: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;
  // NOTA: NO se acepta "role" desde el cliente. El registro publico siempre
  // crea CANDIDATE en el use-case. Permitir role aqui era un riesgo de
  // escalacion de privilegios si en algun momento se hacia ...dto sin filtro.
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class TokensDto {
  accessToken: string;
  refreshToken: string;
}

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    mustChangePassword?: boolean;
  };
  tokens: TokensDto;
}
