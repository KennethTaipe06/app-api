import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ISessionRepository } from '../../../domain/repositories';
import { SESSION_REPOSITORY } from '../../../domain/repositories';
import type { IProctoringAlertRepository } from '../../../domain/repositories/proctoring-alert.repository';
import { PROCTORING_ALERT_REPOSITORY } from '../../../domain/repositories/proctoring-alert.repository';
import type { IStorageService } from '../../ports/storage.port';
import { STORAGE_SERVICE } from '../../ports/storage.port';
import { CreateAlertDto } from '../../dtos';
import { ProctoringGateway } from '../../../presentation/gateways/proctoring.gateway';

@Injectable()
export class CreateAlertUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(PROCTORING_ALERT_REPOSITORY)
    private readonly alertRepository: IProctoringAlertRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly proctoringGateway: ProctoringGateway,
  ) {}

  async execute(dto: CreateAlertDto) {
    const session = await this.sessionRepository.findById(dto.sessionId);
    if (!session) {
      throw new NotFoundException('Sesion no encontrada');
    }

    let screenshotUrl: string | null = null;
    if (dto.screenshotBase64) {
      // Limitar a 5MB en base64 (~3.7MB imagen real)
      if (dto.screenshotBase64.length > 5_242_880) {
        dto.screenshotBase64 = undefined;
      }
    }
    if (dto.screenshotBase64) {
      const buffer = Buffer.from(dto.screenshotBase64, 'base64');
      screenshotUrl = await this.storageService.uploadFile(
        'biometrics',
        `sessions/${dto.sessionId}/alert-${Date.now()}.jpg`,
        buffer,
        'image/jpeg',
      );
    }

    const alert = await this.alertRepository.create({
      sessionId: dto.sessionId,
      type: dto.type,
      data: dto.data || {},
      screenshotUrl,
    });

    // Emitir alerta en tiempo real a monitores
    this.proctoringGateway.emitAlert(dto.sessionId, {
      type: dto.type,
      data: dto.data,
    });

    return alert;
  }
}
