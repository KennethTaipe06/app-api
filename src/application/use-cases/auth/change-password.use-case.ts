import {
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories';
import { USER_REPOSITORY } from '../../../domain/repositories';
import { ChangePasswordDto } from '../../dtos/batch-candidates.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('La contrasena actual es incorrecta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'La nueva contrasena debe ser diferente a la actual',
      );
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.userRepository.update(userId, {
      password: hashedNewPassword,
      mustChangePassword: false,
    } as any);

    // Revocar refresh token: cualquier sesion previa queda invalidada.
    // El cliente debera autenticarse nuevamente desde otros dispositivos.
    await this.userRepository.updateRefreshToken(userId, null);
  }
}
