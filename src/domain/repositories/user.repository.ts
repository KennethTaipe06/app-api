import { UserEntity } from '../entities';
import { Role } from '../enums';

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByCedula(cedula: string): Promise<UserEntity | null>;
  findByEmailsOrCedulas(
    emails: string[],
    cedulas: string[],
  ): Promise<UserEntity[]>;
  findAll(filters?: { role?: Role; isActive?: boolean }): Promise<UserEntity[]>;
  create(user: Partial<UserEntity>): Promise<UserEntity>;
  update(id: string, data: Partial<UserEntity>): Promise<UserEntity>;
  delete(id: string): Promise<void>;
  updateRefreshToken(id: string, token: string | null): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
