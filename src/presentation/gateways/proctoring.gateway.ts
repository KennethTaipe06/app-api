import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { IProctoringAlertRepository } from '../../domain/repositories/proctoring-alert.repository';
import { PROCTORING_ALERT_REPOSITORY } from '../../domain/repositories/proctoring-alert.repository';
import type { ISessionRepository } from '../../domain/repositories/session.repository';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository';
import { SessionStatus, AlertType } from '../../domain/enums';
import { WebhookService } from '../../infrastructure/services/webhook.service';

const DISCONNECT_GRACE_MS = parseInt(
  process.env.PROCTORING_DISCONNECT_GRACE_MS || '15000',
  10,
);

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  },
  namespace: '/proctoring',
})
export class ProctoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(PROCTORING_ALERT_REPOSITORY)
    private readonly alertRepository: IProctoringAlertRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtService: JwtService,
    private readonly webhookService: WebhookService,
  ) {}

  private readonly logger = new Logger(ProctoringGateway.name);

  private connectedClients = new Map<
    string,
    { role: string; userId: string; sessionId?: string }
  >();

  /** Timers de gracia para candidatos desconectados — si reconectan a tiempo se cancela */
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Cache de nombres de candidatos por sessionId para enriquecer alertas */
  private candidateNameCache = new Map<string, string>();

  handleConnection(client: Socket) {
    // SIEMPRE requerir JWT valido. El fallback legacy de query params
    // (?role=EXAMINER&userId=...) era trivial de suplantar: cualquiera
    // podia entrar al room "monitors" sin autenticacion.
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query.token as string);

    if (!token) {
      this.logger.warn(`WS reject: ${client.id} — sin token`);
      client.disconnect();
      return;
    }

    let payload: { sub?: string; role?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      this.logger.warn(`WS Auth failed: ${client.id} — token invalido`);
      client.disconnect();
      return;
    }

    const role = payload.role as string;
    const userId = payload.sub as string;
    const sessionId = client.handshake.query.sessionId as string | undefined;

    if (!role || !userId) {
      client.disconnect();
      return;
    }

    this.connectedClients.set(client.id, { role, userId, sessionId });

    if (
      role === 'EXAMINER' ||
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'AUDITOR'
    ) {
      client.join('monitors');
    }

    if (role === 'CANDIDATE' && sessionId) {
      // Validar que la sesion realmente le pertenezca antes de unirlo al room.
      void this.sessionRepository
        .findById(sessionId)
        .then((session) => {
          if (!session || session.candidateId !== userId) {
            this.logger.warn(
              `WS reject join: userId=${userId} no es dueno de sessionId=${sessionId}`,
            );
            client.disconnect();
            return;
          }
          client.join(`session:${sessionId}`);
          this.cancelDisconnectTimer(sessionId);
          this.server
            .to('monitors')
            .emit('candidate:online', { sessionId, userId });
        })
        .catch(() => client.disconnect());
    }

    this.logger.log(`WS Connected: ${client.id} (${role})`);
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);

    if (clientInfo?.role === 'CANDIDATE' && clientInfo.sessionId) {
      const { sessionId, userId } = clientInfo;

      // Verificar si hay otra conexion activa del mismo candidato para esta sesion
      const hasOtherConnection = Array.from(
        this.connectedClients.values(),
      ).some(
        (c) =>
          c.role === 'CANDIDATE' &&
          c.userId === userId &&
          c.sessionId === sessionId,
      );

      if (!hasOtherConnection) {
        this.server
          .to('monitors')
          .emit('candidate:offline', { sessionId, userId });
        this.logger.warn(
          `Candidato desconectado: userId=${userId} sessionId=${sessionId}. Gracia de ${DISCONNECT_GRACE_MS}ms antes de descalificar.`,
        );

        const timer = setTimeout(() => {
          this.disconnectTimers.delete(sessionId);
          void this.disqualifySession(sessionId, userId);
        }, DISCONNECT_GRACE_MS);

        this.disconnectTimers.set(sessionId, timer);
      }
    }

    this.logger.log(`WS Disconnected: ${client.id}`);
  }

  private cancelDisconnectTimer(sessionId: string) {
    const timer = this.disconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(sessionId);
      this.logger.log(
        `Candidato reconecto a tiempo, timer cancelado: sessionId=${sessionId}`,
      );
    }
  }

  private async disqualifySession(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) return;

      // Solo descalificar si la sesion esta activa
      if (session.status !== SessionStatus.IN_PROGRESS) {
        this.logger.log(
          `Sesion ${sessionId} no esta IN_PROGRESS (${session.status}), omitiendo descalificacion.`,
        );
        return;
      }

      // Marcar sesion como DISQUALIFIED
      await this.sessionRepository.update(sessionId, {
        status: SessionStatus.DISQUALIFIED,
        finishedAt: new Date(),
      });

      // Crear alerta de BROWSER_CLOSED
      await this.alertRepository.create({
        sessionId,
        type: AlertType.BROWSER_CLOSED as any,
        data: {
          reason: 'Candidato cerro el navegador o la pestaña del examen',
          userId,
          disconnectedAt: new Date().toISOString(),
        },
        screenshotUrl: null,
      });

      // Notificar a monitores via socket
      this.server.to('monitors').emit('session:disqualified', {
        sessionId,
        userId,
        reason: 'BROWSER_CLOSED',
        timestamp: new Date().toISOString(),
      });

      const candidateName = await this.resolveCandidateName(sessionId);

      this.server.to('monitors').emit('alert:new', {
        sessionId,
        type: AlertType.BROWSER_CLOSED,
        data: {
          reason: 'Candidato cerro el navegador o la pestaña del examen',
          userId,
        },
        candidateName,
      });

      // Obtener info adicional para el webhook
      const sessionWithRelations =
        await this.sessionRepository.findByIdWithRelations(sessionId);

      // Enviar webhook al examinador
      await this.webhookService.notifyExaminer({
        event: 'session.disqualified',
        sessionId,
        candidateId: userId,
        candidateName:
          (sessionWithRelations as any)?.candidate?.name || undefined,
        testName: (sessionWithRelations as any)?.test?.name || undefined,
        reason: 'Candidato cerro el navegador o la pestaña durante el examen',
        timestamp: new Date().toISOString(),
        data: { previousStatus: 'IN_PROGRESS', newStatus: 'DISQUALIFIED' },
      });

      this.logger.warn(
        `Sesion ${sessionId} DESCALIFICADA: candidato ${userId} cerro el navegador.`,
      );
    } catch (err) {
      this.logger.error(
        `Error descalificando sesion ${sessionId}: ${(err as Error)?.message}`,
      );
    }
  }

  @SubscribeMessage('session:answer')
  handleAnswer(
    client: Socket,
    payload: { sessionId: string; questionNumber: number },
  ) {
    // Solo candidatos autenticados pueden anunciar avances en su propia sesion.
    const clientInfo = this.connectedClients.get(client.id);
    if (
      !clientInfo ||
      clientInfo.role !== 'CANDIDATE' ||
      clientInfo.sessionId !== payload?.sessionId
    ) {
      return;
    }
    this.server.to('monitors').emit('session:answered', payload);
  }

  @SubscribeMessage('proctoring:alert')
  async handleAlert(
    client: Socket,
    payload: {
      sessionId: string;
      type: string;
      data?: Record<string, unknown>;
    },
  ) {
    if (!payload || !payload.sessionId || !payload.type) return;

    // Ownership: el candidato solo puede emitir alertas sobre sus sesiones.
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo || clientInfo.role !== 'CANDIDATE') return;

    const session = await this.sessionRepository.findById(payload.sessionId);
    if (!session || session.candidateId !== clientInfo.userId) {
      this.logger.warn(
        `WS alert rechazado: userId=${clientInfo.userId} no es dueno de sessionId=${payload.sessionId}`,
      );
      return;
    }

    // Validar type contra el enum AlertType para evitar valores arbitrarios.
    if (!Object.values(AlertType).includes(payload.type as AlertType)) {
      this.logger.warn(`WS alert tipo invalido: ${payload.type}`);
      return;
    }

    try {
      await this.alertRepository.create({
        sessionId: payload.sessionId,
        type: payload.type as AlertType,
        data: payload.data || {},
        screenshotUrl: null,
      });

      const candidateName = await this.resolveCandidateName(payload.sessionId);

      this.server.to('monitors').emit('alert:new', {
        sessionId: payload.sessionId,
        type: payload.type,
        data: payload.data,
        candidateName,
      });
    } catch (err) {
      this.logger.error(
        `Error guardando alerta WS para sesion ${payload.sessionId}: ${err}`,
      );
    }
  }

  async emitAlert(
    sessionId: string,
    alert: { type: string; data?: Record<string, unknown> },
  ) {
    const candidateName = await this.resolveCandidateName(sessionId);
    this.server
      .to('monitors')
      .emit('alert:new', { sessionId, ...alert, candidateName });
  }

  private async resolveCandidateName(sessionId: string): Promise<string> {
    const cached = this.candidateNameCache.get(sessionId);
    if (cached) return cached;

    try {
      const session =
        await this.sessionRepository.findByIdWithRelations(sessionId);
      const candidate = (session as any)?.candidate;
      const name = candidate
        ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
        : 'Desconocido';
      this.candidateNameCache.set(sessionId, name);
      return name;
    } catch {
      return 'Desconocido';
    }
  }

  emitSessionStarted(session: {
    id: string;
    candidateName: string;
    testName: string;
  }) {
    this.server.to('monitors').emit('session:started', session);
  }

  emitSessionFinished(sessionId: string) {
    this.server.to('monitors').emit('session:finished', { sessionId });
  }
}
