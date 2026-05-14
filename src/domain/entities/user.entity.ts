import { Role } from '../enums';

export class UserEntity {
  id: string;
  email: string;
  password: string;
  cedula: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  profilePhotoUrl: string | null;
  faceDescriptor: number[];
  refreshToken: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isAdmin(): boolean {
    return this.role === Role.SUPER_ADMIN || this.role === Role.ADMIN;
  }

  canMonitor(): boolean {
    return [Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER].includes(this.role);
  }

  canTakeExam(): boolean {
    return this.role === Role.CANDIDATE && this.isActive;
  }
}
