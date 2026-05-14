import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Inject,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Roles } from '../decorators/roles.decorator';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role, SessionStatus, AlertType } from '../../domain/enums';
import {
  StartExamUseCase,
  SubmitAnswerUseCase,
  FinishExamUseCase,
} from '../../application/use-cases/sessions';
import type { IAnswerRepository } from '../../domain/repositories';
import { ANSWER_REPOSITORY } from '../../domain/repositories';
import type { IProctoringAlertRepository } from '../../domain/repositories/proctoring-alert.repository';
import { PROCTORING_ALERT_REPOSITORY } from '../../domain/repositories/proctoring-alert.repository';
import { CalculateResultUseCase } from '../../application/use-cases/results';
import type {
  ISessionRepository,
  IResultRepository,
} from '../../domain/repositories';
import {
  SESSION_REPOSITORY,
  RESULT_REPOSITORY,
} from '../../domain/repositories';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { WebhookService } from '../../infrastructure/services/webhook.service';
import { ProctoringGateway } from '../gateways/proctoring.gateway';

@Controller('sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly startExamUseCase: StartExamUseCase,
    private readonly submitAnswerUseCase: SubmitAnswerUseCase,
    private readonly finishExamUseCase: FinishExamUseCase,
    private readonly calculateResultUseCase: CalculateResultUseCase,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: IResultRepository,
    @Inject(ANSWER_REPOSITORY)
    private readonly answerRepository: IAnswerRepository,
    @Inject(PROCTORING_ALERT_REPOSITORY)
    private readonly alertRepository: IProctoringAlertRepository,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly webhookService: WebhookService,
    private readonly proctoringGateway: ProctoringGateway,
  ) {}

  @Post('start')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async startExam(
    @Body() body: { testId: string },
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.startExamUseCase.execute({
      testId: body.testId,
      candidateId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('active')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async getActiveSessions() {
    return this.sessionRepository.findActive();
  }

  @Get('my')
  @Roles(Role.CANDIDATE)
  async getMySessions(@CurrentUser() user: any) {
    return this.sessionRepository.findByCandidate(user.id);
  }

  @Post(':id/answer')
  @Roles(Role.CANDIDATE)
  async submitAnswer(
    @Param('id') sessionId: string,
    @CurrentUser() user: any,
    @Body()
    body: {
      questionId: string;
      questionNumber: number;
      response: any;
      responseTimeMs: number;
    },
  ) {
    // Ownership: candidato solo puede responder en sus sesiones.
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new BadRequestException('Sesion no encontrada');
    }
    if (session.candidateId !== user.id) {
      throw new ForbiddenException('La sesion no pertenece al candidato');
    }
    return this.submitAnswerUseCase.execute(sessionId, {
      questionId: body.questionId,
      questionNumber: body.questionNumber,
      response: body.response,
      responseTimeMs: body.responseTimeMs,
    });
  }

  /**
   * Recibe un lote de respuestas en una sola request.
   * El front acumula respuestas y las envia cada N preguntas o cada N segundos.
   * Reduce ~345 requests individuales a ~35 requests por bateria.
   */
  @Post(':id/answers/batch')
  @Roles(Role.CANDIDATE)
  async submitAnswersBatch(
    @Param('id') sessionId: string,
    @CurrentUser() user: any,
    @Body('answers')
    answers: {
      questionId: string;
      questionNumber: number;
      response: any;
      responseTimeMs: number;
    }[],
  ) {
    if (!Array.isArray(answers) || answers.length === 0) {
      return { saved: 0 };
    }
    // Cota dura: ningun test pasa de ~200 preguntas; aceptar batches
    // arbitrariamente grandes puede saturar la BD.
    if (answers.length > 500) {
      throw new BadRequestException('Batch demasiado grande (max 500)');
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session || !session.isActive()) {
      return { saved: 0 };
    }
    // Ownership: solo el dueno de la sesion puede enviar respuestas.
    if (session.candidateId !== user.id) {
      throw new ForbiddenException('La sesion no pertenece al candidato');
    }

    // Insertar todas las respuestas de una vez con createMany
    const saved = await this.answerRepository.createMany(
      answers.map((a) => ({
        sessionId,
        questionId: a.questionId,
        questionNumber: a.questionNumber,
        response: a.response,
        responseTimeMs: a.responseTimeMs,
      })),
    );

    // Actualizar currentQuestion al mayor numero del batch
    const maxQuestion = Math.max(...answers.map((a) => a.questionNumber));
    await this.sessionRepository.update(sessionId, {
      currentQuestion: maxQuestion + 1,
    });

    return { saved };
  }

  @Post(':id/finish')
  @Roles(Role.CANDIDATE)
  async finishExam(@Param('id') sessionId: string, @CurrentUser() user: any) {
    // Ownership: solo el dueno puede finalizar su sesion.
    const owner = await this.sessionRepository.findById(sessionId);
    if (!owner) {
      throw new BadRequestException('Sesion no encontrada');
    }
    if (owner.candidateId !== user.id) {
      throw new ForbiddenException('La sesion no pertenece al candidato');
    }
    // Atomico: finish + calculate en una sola operacion
    // Si calculate falla, el examen queda marcado como completado pero sin resultado
    // — se puede recalcular luego. Mejor que dejar la sesion en estado inconsistente.
    const session = await this.finishExamUseCase.execute(sessionId);
    let result;
    try {
      result = await this.calculateResultUseCase.execute(sessionId);
    } catch (err) {
      // Log pero no bloquear: el examen ya termino, resultado se puede recalcular
      console.error(
        `Error calculando resultado para sesion ${sessionId}:`,
        err,
      );
      result = null;
    }

    // Check if this is part of a battery — if so, auto-start the next test
    let nextSessionId: string | null = null;
    if (session.scheduledExamId) {
      const nextPending = await this.prisma.examSession.findFirst({
        where: {
          scheduledExamId: session.scheduledExamId,
          candidateId: session.candidateId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
      });
      if (nextPending) {
        // Auto-start the next session
        await this.prisma.examSession.update({
          where: { id: nextPending.id },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            currentQuestion: 1,
          },
        });
        nextSessionId = nextPending.id;
      } else {
        // All tests finished — mark candidate assignment as COMPLETED
        await this.prisma.scheduledExamCandidate.updateMany({
          where: {
            scheduledExamId: session.scheduledExamId,
            candidateId: session.candidateId,
          },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });
      }
    }

    return {
      message: 'Examen finalizado',
      result,
      nextSessionId,
    };
  }

  // Battery info: get all sessions for this battery + global timer
  @Get(':id/battery')
  @Roles(Role.CANDIDATE)
  async getBatteryInfo(
    @Param('id') sessionId: string,
    @CurrentUser() user: any,
  ) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { test: true },
    });

    if (!session) {
      return { isBattery: false };
    }

    if (!session.scheduledExamId) {
      return { isBattery: false };
    }

    const scheduledExam = await this.prisma.scheduledExam.findUnique({
      where: { id: session.scheduledExamId },
    });

    if (!scheduledExam) {
      return { isBattery: false };
    }

    const allSessions = await this.prisma.examSession.findMany({
      where: {
        scheduledExamId: session.scheduledExamId,
        candidateId: user.id,
      },
      include: { test: true },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate global deadline
    const candidateAssignment =
      await this.prisma.scheduledExamCandidate.findFirst({
        where: {
          scheduledExamId: session.scheduledExamId,
          candidateId: user.id,
        },
      });

    const globalStartedAt = candidateAssignment?.startedAt || new Date();
    const globalDeadline = new Date(
      globalStartedAt.getTime() + scheduledExam.durationMin * 60 * 1000,
    );

    const currentIndex = allSessions.findIndex((s) => s.id === sessionId);

    return {
      isBattery: true,
      currentIndex: currentIndex + 1,
      totalTests: allSessions.length,
      globalDeadline: globalDeadline.toISOString(),
      globalDurationMin: scheduledExam.durationMin,
      sessions: allSessions.map((s) => ({
        id: s.id,
        testType: s.test.type,
        testName: s.test.name,
        status: s.status,
        totalQuestions: s.test.totalQuestions,
        instructions: s.test.instructions,
      })),
    };
  }

  @Get(':id/result')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getResult(@Param('id') sessionId: string) {
    return this.resultRepository.findBySessionWithScales(sessionId);
  }

  /**
   * Endpoint para sendBeacon del frontend al cerrar navegador.
   * sendBeacon no puede enviar headers de autorizacion, por eso el token va en el body
   * y este endpoint es @Public (sin JWT guard).
   */
  @Post(':id/browser-closed')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleBrowserClosed(
    @Param('id') sessionId: string,
    @Body() body: { token?: string },
  ) {
    // Verificar token manualmente (sendBeacon no soporta headers)
    let userId: string | null = null;
    if (body.token) {
      try {
        const payload = this.jwtService.verify(body.token);
        userId = payload.sub;
      } catch {
        this.logger.warn(
          `browser-closed: token invalido para sesion ${sessionId}`,
        );
        return { ok: false };
      }
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.status !== SessionStatus.IN_PROGRESS) {
      return { ok: false };
    }

    // Verificar que el usuario es el dueño de la sesión
    if (userId && session.candidateId !== userId) {
      return { ok: false };
    }

    // Descalificar TODAS las sesiones de la misma batería (no solo la actual)
    const sessionIdsToDisqualify = [sessionId];
    if (session.scheduledExamId) {
      const batterySessions =
        await this.sessionRepository.findIdsByScheduledExam(
          session.scheduledExamId,
          session.candidateId,
        );
      for (const sid of batterySessions) {
        if (sid !== sessionId && !sessionIdsToDisqualify.includes(sid)) {
          sessionIdsToDisqualify.push(sid);
        }
      }
    }

    for (const sid of sessionIdsToDisqualify) {
      await this.sessionRepository
        .update(sid, {
          status: SessionStatus.DISQUALIFIED,
          finishedAt: new Date(),
        })
        .catch(() => {});
    }

    await this.alertRepository.create({
      sessionId,
      type: AlertType.BROWSER_CLOSED as any,
      data: {
        reason: 'Candidato cerro el navegador (beacon)',
        userId: userId || session.candidateId,
        source: 'beacon',
        disqualifiedSessions: sessionIdsToDisqualify,
      },
      screenshotUrl: null,
    });

    // Notificar a monitores via socket
    this.proctoringGateway.server.to('monitors').emit('session:disqualified', {
      sessionId,
      userId: userId || session.candidateId,
      reason: 'BROWSER_CLOSED',
      timestamp: new Date().toISOString(),
    });

    // Webhook al examinador
    const sessionWithRelations =
      await this.sessionRepository.findByIdWithRelations(sessionId);

    await this.webhookService.notifyExaminer({
      event: 'session.disqualified',
      sessionId,
      candidateId: session.candidateId,
      candidateName:
        (sessionWithRelations as any)?.candidate?.name || undefined,
      testName: (sessionWithRelations as any)?.test?.name || undefined,
      reason: 'Candidato cerro el navegador durante el examen (beacon)',
      timestamp: new Date().toISOString(),
      data: { previousStatus: 'IN_PROGRESS', newStatus: 'DISQUALIFIED' },
    });

    this.logger.warn(
      `Sesion ${sessionId} DESCALIFICADA via beacon: candidato cerro el navegador.`,
    );

    return { ok: true };
  }

  @Post(':id/disqualify')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async disqualifySession(
    @Param('id') sessionId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: any,
  ) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return { ok: false, message: 'Sesión no encontrada' };
    }

    // Solo el examinador propietario (o ADMIN/SUPER_ADMIN) puede expulsar.
    if (
      user.role === Role.EXAMINER &&
      session.examinerId &&
      session.examinerId !== user.id
    ) {
      throw new ForbiddenException(
        'No tienes permiso para descalificar esta sesion',
      );
    }

    if (session.status !== SessionStatus.IN_PROGRESS) {
      return { ok: false, message: 'La sesión no está en progreso' };
    }

    const reason = body.reason || 'Expulsado por el examinador';

    // Descalificar TODAS las sesiones de la misma batería
    const sessionIdsToDisqualify = [sessionId];
    if (session.scheduledExamId) {
      const batterySessions =
        await this.sessionRepository.findIdsByScheduledExam(
          session.scheduledExamId,
          session.candidateId,
        );
      for (const sid of batterySessions) {
        if (sid !== sessionId && !sessionIdsToDisqualify.includes(sid)) {
          sessionIdsToDisqualify.push(sid);
        }
      }
    }

    for (const sid of sessionIdsToDisqualify) {
      await this.sessionRepository
        .update(sid, {
          status: SessionStatus.DISQUALIFIED,
          finishedAt: new Date(),
        })
        .catch(() => {});
    }

    await this.alertRepository.create({
      sessionId,
      type: AlertType.BROWSER_CLOSED as any,
      data: {
        reason,
        expelledBy: user.id,
        source: 'examiner',
        disqualifiedSessions: sessionIdsToDisqualify,
      },
      screenshotUrl: null,
    });

    // Notificar al candidato para que su pantalla se bloquee (todos los rooms)
    for (const sid of sessionIdsToDisqualify) {
      this.proctoringGateway.server
        .to(`session:${sid}`)
        .emit('session:expelled', {
          sessionId: sid,
          reason,
        });
    }

    // Notificar a monitores
    const sessionWithRelations =
      await this.sessionRepository.findByIdWithRelations(sessionId);
    const candidate = (sessionWithRelations as any)?.candidate;
    const candidateName = candidate
      ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
      : 'Desconocido';

    this.proctoringGateway.server.to('monitors').emit('session:disqualified', {
      sessionId,
      userId: session.candidateId,
      reason,
      timestamp: new Date().toISOString(),
    });

    this.proctoringGateway.server.to('monitors').emit('alert:new', {
      sessionId,
      type: 'EXPELLED',
      data: { reason, expelledBy: user.id },
      candidateName,
    });

    this.logger.warn(`Sesión ${sessionId} EXPULSADA por ${user.id}: ${reason}`);

    return { ok: true, message: `${candidateName} ha sido expulsado` };
  }
}
