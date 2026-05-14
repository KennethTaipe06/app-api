import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IProctoringAlertRepository } from '../../../../domain/repositories/proctoring-alert.repository';
import { ProctoringAlertEntity } from '../../../../domain/entities';

@Injectable()
export class PrismaProctoringAlertRepository implements IProctoringAlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Partial<ProctoringAlertEntity>,
  ): Promise<ProctoringAlertEntity> {
    const alert = await this.prisma.proctoringAlert.create({
      data: {
        sessionId: data.sessionId!,
        type: data.type as any,
        data: (data.data || {}) as any,
        screenshotUrl: data.screenshotUrl || null,
      },
    });
    return this.toEntity(alert);
  }

  async findBySessionId(sessionId: string): Promise<ProctoringAlertEntity[]> {
    const alerts = await this.prisma.proctoringAlert.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map((a) => this.toEntity(a));
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return this.prisma.proctoringAlert.count({
      where: { sessionId },
    });
  }

  async findRecent(limit: number): Promise<ProctoringAlertEntity[]> {
    const alerts = await this.prisma.proctoringAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        session: {
          include: {
            candidate: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    return alerts.map((a) => {
      const entity = this.toEntity(a);
      // Attach candidateName for the examiner dashboard
      const candidate = (a as any).session?.candidate;
      (entity as any).candidateName = candidate
        ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
        : undefined;
      return entity;
    });
  }

  private toEntity(raw: any): ProctoringAlertEntity {
    const entity = new ProctoringAlertEntity();
    Object.assign(entity, raw);
    return entity;
  }
}
