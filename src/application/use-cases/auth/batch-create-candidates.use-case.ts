import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/repositories';
import { USER_REPOSITORY } from '../../../domain/repositories';
import {
  EMAIL_SERVICE,
  type IEmailService,
} from '../../../infrastructure/services/email.service';
import { BatchCreateCandidatesDto } from '../../dtos/batch-candidates.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface BatchResult {
  created: { email: string; firstName: string; lastName: string }[];
  failed: { email: string; reason: string }[];
}

@Injectable()
export class BatchCreateCandidatesUseCase {
  private readonly logger = new Logger(BatchCreateCandidatesUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: IEmailService,
  ) {}

  async execute(dto: BatchCreateCandidatesDto): Promise<BatchResult> {
    const result: BatchResult = { created: [], failed: [] };

    // Batch lookup: 1 query en vez de 2N queries
    const emails = dto.candidates.map((c) => c.email);
    const cedulas = dto.candidates.map((c) => c.cedula);
    const existingUsers = await this.userRepository.findByEmailsOrCedulas(
      emails,
      cedulas,
    );

    const existingEmails = new Set(existingUsers.map((u) => u.email));
    const existingCedulas = new Set(existingUsers.map((u) => u.cedula));

    for (const candidate of dto.candidates) {
      try {
        if (existingEmails.has(candidate.email)) {
          result.failed.push({
            email: candidate.email,
            reason: 'El email ya esta registrado',
          });
          continue;
        }

        if (existingCedulas.has(candidate.cedula)) {
          result.failed.push({
            email: candidate.email,
            reason: `La cedula ${candidate.cedula} ya esta registrada`,
          });
          continue;
        }

        // 16 chars hex (2^64 entropy) en vez de 8 chars
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await this.userRepository.create({
          email: candidate.email,
          password: hashedPassword,
          cedula: candidate.cedula,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          role: 'CANDIDATE' as any,
          mustChangePassword: true,
        } as any);

        // Evitar duplicados en el mismo batch
        existingEmails.add(candidate.email);
        existingCedulas.add(candidate.cedula);

        try {
          await this.emailService.sendTemporaryPassword(
            candidate.email,
            candidate.firstName,
            tempPassword,
          );
        } catch {
          this.logger.warn(
            `User created but email failed for ${candidate.email}`,
          );
        }

        result.created.push({
          email: candidate.email,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
        });
      } catch (error) {
        this.logger.error(
          `Failed to create candidate ${candidate.email}`,
          (error as Error).stack,
        );
        result.failed.push({
          email: candidate.email,
          reason: 'Error interno al crear usuario',
        });
      }
    }

    return result;
  }
}
