import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  RegisterUseCase,
  LoginUseCase,
  RefreshTokenUseCase,
  BatchCreateCandidatesUseCase,
  ChangePasswordUseCase,
} from '../../application/use-cases/auth';
import { RegisterDto, LoginDto } from '../../application/dtos';
import {
  BatchCreateCandidatesDto,
  ChangePasswordDto,
} from '../../application/dtos';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import type { IUserRepository } from '../../domain/repositories';
import { USER_REPOSITORY } from '../../domain/repositories';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly batchCreateCandidatesUseCase: BatchCreateCandidatesUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 registros por minuto por IP
  async register(@Body() dto: RegisterDto) {
    const user = await this.registerUseCase.execute(dto);
    return {
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 intentos por minuto por IP
  async login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 30 } }) // limitar abuso
  async refresh(@Body() body: { refreshToken?: unknown }) {
    if (
      !body ||
      typeof body.refreshToken !== 'string' ||
      body.refreshToken.length < 20 ||
      body.refreshToken.length > 4096
    ) {
      // Mensaje generico para no filtrar formato del token.
      throw new UnauthorizedException('Refresh token invalido');
    }
    return this.refreshTokenUseCase.execute(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any) {
    await this.userRepository.updateRefreshToken(user.id, null);
    return { message: 'Sesion cerrada exitosamente' };
  }

  @Post('batch-candidates')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async batchCreateCandidates(@Body() dto: BatchCreateCandidatesDto) {
    return this.batchCreateCandidatesUseCase.execute(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUseCase.execute(user.id, dto);
    return { message: 'Contrasena actualizada exitosamente' };
  }
}
