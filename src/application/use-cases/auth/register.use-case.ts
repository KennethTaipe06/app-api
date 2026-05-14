import { Inject, Injectable, ConflictException } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories';
import { USER_REPOSITORY } from '../../../domain/repositories';
import { RegisterDto } from '../../dtos';
import { UserEntity } from '../../../domain/entities';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: RegisterDto): Promise<UserEntity> {
    const existingEmail = await this.userRepository.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('El email ya esta registrado');
    }

    const existingCedula = await this.userRepository.findByCedula(dto.cedula);
    if (existingCedula) {
      throw new ConflictException('La cedula ya esta registrada');
    }

    // OWASP 2024: mínimo 10 rounds para seguridad
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.userRepository.create({
      ...dto,
      password: hashedPassword,
      role: 'CANDIDATE' as any, // Registro publico SOLO crea candidatos
    });
  }
}
