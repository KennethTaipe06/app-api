import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IUserRepository } from '../../../../domain/repositories';
import { UserEntity } from '../../../../domain/entities';
import { Role } from '../../../../domain/enums';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.toEntity(user) : null;
  }

  async findByCedula(cedula: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { cedula } });
    return user ? this.toEntity(user) : null;
  }

  async findByEmailsOrCedulas(
    emails: string[],
    cedulas: string[],
  ): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [{ email: { in: emails } }, { cedula: { in: cedulas } }],
      },
    });
    return users.map((u) => this.toEntity(u));
  }

  async findAll(filters?: {
    role?: Role;
    isActive?: boolean;
  }): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: filters?.role,
        isActive: filters?.isActive,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.toEntity(u));
  }

  async create(data: Partial<UserEntity>): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email!,
        password: data.password!,
        cedula: data.cedula!,
        firstName: data.firstName!,
        lastName: data.lastName!,
        ...(data.role ? { role: data.role as any } : {}),
        ...(data.mustChangePassword !== undefined
          ? { mustChangePassword: data.mustChangePassword }
          : {}),
      },
    });
    return this.toEntity(user);
  }

  async update(id: string, data: Partial<UserEntity>): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data: data as any,
    });
    return this.toEntity(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async updateRefreshToken(id: string, token: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { refreshToken: token, lastLoginAt: new Date() },
    });
  }

  private toEntity(raw: any): UserEntity {
    const entity = new UserEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
