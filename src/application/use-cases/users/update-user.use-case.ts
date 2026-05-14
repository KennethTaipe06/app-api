import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories';
import { USER_REPOSITORY } from '../../../domain/repositories';
import { UpdateUserDto } from '../../dtos';
import { UserEntity } from '../../../domain/entities';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserDto,
    requesterId: string,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // No permitir que un usuario se desactive a si mismo
    if (id === requesterId && dto.isActive === false) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }

    return this.userRepository.update(id, dto as Partial<UserEntity>);
  }
}
