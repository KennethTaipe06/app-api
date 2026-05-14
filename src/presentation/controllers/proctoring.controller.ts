import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import { CreateAlertDto } from '../../application/dtos';
import { CreateAlertUseCase } from '../../application/use-cases/proctoring';
import type { IProctoringAlertRepository } from '../../domain/repositories/proctoring-alert.repository';
import { PROCTORING_ALERT_REPOSITORY } from '../../domain/repositories/proctoring-alert.repository';
import type { ISessionRepository } from '../../domain/repositories';
import { SESSION_REPOSITORY } from '../../domain/repositories';

@Controller('proctoring')
export class ProctoringController {
  constructor(
    private readonly createAlertUseCase: CreateAlertUseCase,
    @Inject(PROCTORING_ALERT_REPOSITORY)
    private readonly alertRepository: IProctoringAlertRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  @Post('alert')
  @Roles(Role.CANDIDATE)
  async createAlert(@Body() dto: CreateAlertDto, @CurrentUser() user: any) {
    // Verificar ownership: el candidato solo puede registrar alertas en SUS
    // sesiones. Sin este chequeo, cualquier candidato logueado podia inyectar
    // alertas/screenshots en sesiones ajenas.
    const session = await this.sessionRepository.findById(dto.sessionId);
    if (!session) {
      throw new NotFoundException('Sesion no encontrada');
    }
    if (session.candidateId !== user.id) {
      throw new ForbiddenException('La sesion no pertenece al candidato');
    }
    return this.createAlertUseCase.execute(dto);
  }

  @Get('alerts/recent')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getRecentAlerts() {
    return this.alertRepository.findRecent(100);
  }

  @Get('alerts/:sessionId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getAlerts(@Param('sessionId') sessionId: string) {
    return this.alertRepository.findBySessionId(sessionId);
  }

  @Get('alerts/:sessionId/count')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getAlertCount(@Param('sessionId') sessionId: string) {
    const alertCount = await this.alertRepository.countBySessionId(sessionId);
    return { sessionId, alertCount };
  }
}
