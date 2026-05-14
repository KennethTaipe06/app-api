import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Inject,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import type { IUserRepository } from '../../domain/repositories';
import { USER_REPOSITORY } from '../../domain/repositories';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from '../../application/dtos';
import { UpdateUserUseCase } from '../../application/use-cases/users';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly updateUserUseCase: UpdateUserUseCase,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async findAll(@Query('role') role?: Role) {
    const users = await this.userRepository.findAll({ role });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      cedula: u.cedula,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    const fullUser = await this.userRepository.findById(user.id);
    return {
      id: fullUser!.id,
      email: fullUser!.email,
      cedula: fullUser!.cedula,
      firstName: fullUser!.firstName,
      lastName: fullUser!.lastName,
      role: fullUser!.role,
      profilePhotoUrl: fullUser!.profilePhotoUrl,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async findOne(@Param('id') id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      id: user.id,
      email: user.email,
      cedula: user.cedula,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * Crear usuario con cualquier rol.
   * Solo SUPER_ADMIN puede crear usuarios.
   */
  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(@Body() dto: CreateUserDto) {
    const existingEmail = await this.userRepository.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('El email ya esta registrado');
    }

    const existingCedula = await this.userRepository.findByCedula(dto.cedula);
    if (existingCedula) {
      throw new ConflictException('La cedula ya esta registrada');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });

    return {
      id: user.id,
      email: user.email,
      cedula: user.cedula,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    // ADMIN no puede cambiar roles ni editar SUPER_ADMINs
    if (user.role === Role.ADMIN) {
      if (dto.role) {
        throw new ForbiddenException('Solo SUPER_ADMIN puede cambiar roles');
      }
      const target = await this.userRepository.findById(id);
      if (target?.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('No puedes editar un SUPER_ADMIN');
      }
    }

    const updated = await this.updateUserUseCase.execute(id, dto, user.id);
    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      isActive: updated.isActive,
    };
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: any,
  ) {
    // ADMIN no puede desactivar SUPER_ADMINs ni otros ADMINs
    if (user.role === Role.ADMIN) {
      const target = await this.userRepository.findById(id);
      if (target?.role === Role.SUPER_ADMIN || target?.role === Role.ADMIN) {
        throw new ForbiddenException(
          'No puedes cambiar el estado de un administrador',
        );
      }
    }

    const updated = await this.updateUserUseCase.execute(
      id,
      { isActive: dto.isActive },
      user.id,
    );
    return {
      id: updated.id,
      isActive: updated.isActive,
      message: updated.isActive ? 'Usuario activado' : 'Usuario desactivado',
    };
  }

  /**
   * SUPER_ADMIN o ADMIN pueden resetear la contrasena de un usuario.
   */
  @Patch(':id/reset-password')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @CurrentUser() user: any,
  ) {
    const target = await this.userRepository.findById(id);
    if (!target) throw new NotFoundException('Usuario no encontrado');

    // ADMIN no puede cambiar password de SUPER_ADMIN ni ADMIN
    if (user.role === Role.ADMIN) {
      if (target.role === Role.SUPER_ADMIN || target.role === Role.ADMIN) {
        throw new ForbiddenException(
          'No puedes cambiar la contrasena de un administrador',
        );
      }
    }

    // Politica unificada con change-password: minimo 8, maximo 128.
    if (
      !body.password ||
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      throw new ForbiddenException(
        'La contrasena debe tener entre 8 y 128 caracteres',
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    await this.userRepository.update(id, {
      password: hashedPassword,
      mustChangePassword: true,
    } as any);
    // Revocar cualquier sesion existente del usuario reseteado.
    await this.userRepository.updateRefreshToken(id, null);

    return {
      message:
        'Contrasena actualizada. El usuario debera cambiarla al iniciar sesion.',
    };
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (id === user.id) {
      throw new ForbiddenException('No puedes eliminarte a ti mismo');
    }

    const target = await this.userRepository.findById(id);
    if (!target) throw new NotFoundException('Usuario no encontrado');

    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('No puedes eliminar un SUPER_ADMIN');
    }

    // Soft delete: desactivar en lugar de borrar
    await this.updateUserUseCase.execute(id, { isActive: false }, user.id);

    return { message: 'Usuario desactivado exitosamente' };
  }
}
