import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import {
  CreateScheduledExamDto,
  UpdateScheduledExamDto,
} from '../../application/dtos';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import type { IUserRepository } from '../../domain/repositories';
import { USER_REPOSITORY } from '../../domain/repositories';
import { SessionStatus } from '../../domain/enums';
import { DeepseekRecommendationService } from '../../application/services/deepseek-recommendation.service';
import { IapReportService } from '../../infrastructure/services/iap-report.service';
import { Logger } from '@nestjs/common';

// Orden fijo de la bateria de tests
const BATTERY_ORDER = ['KOSTICK', 'VALANTI', 'DISC', 'PF16'] as const;

@Controller('scheduled-exams')
export class ScheduledExamsController {
  private readonly logger = new Logger(ScheduledExamsController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly deepseekService: DeepseekRecommendationService,
    private readonly iapReportService: IapReportService,
  ) {}

  // ========================================
  // EXAMINER: Crear examen programado (bateria de tests)
  // ========================================
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async create(@Body() dto: CreateScheduledExamDto, @CurrentUser() user: any) {
    // Validar que la fecha es futura
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException(
        'La fecha programada debe ser en el futuro',
      );
    }

    // Determinar qué tests se van a usar
    const selectedTypes: readonly string[] =
      dto.testTypes && dto.testTypes.length > 0
        ? dto.testTypes
        : [...BATTERY_ORDER];

    // Validar que existen tests activos para cada tipo seleccionado
    const tests = await this.prisma.test.findMany({
      where: { isActive: true, type: { in: selectedTypes as any[] } },
    });
    const testsByType = new Map<string, (typeof tests)[0]>(tests.map((t) => [t.type as string, t]));
    const missing = selectedTypes.filter((type) => !testsByType.has(type));
    if (missing.length > 0) {
      throw new BadRequestException(
        `No se encontraron tests activos para: ${missing.join(', ')}. Asegurese de que los tests seleccionados esten registrados y activos.`,
      );
    }

    // Validar que todos los candidatos existen y son CANDIDATE
    for (const candidateId of dto.candidateIds) {
      const candidate = await this.userRepository.findById(candidateId);
      if (!candidate) {
        throw new NotFoundException(
          `Candidato con ID ${candidateId} no encontrado`,
        );
      }
      if (candidate.role.toString() !== 'CANDIDATE') {
        throw new BadRequestException(
          `El usuario ${candidate.email} no tiene rol de candidato`,
        );
      }
    }

    // Crear el examen programado
    const scheduled = await this.prisma.scheduledExam.create({
      data: {
        testId: null,
        createdById: user.id,
        title: dto.title,
        description: dto.description || null,
        scheduledAt,
        durationMin: dto.durationMin || 120,
        testTypes: [...selectedTypes],
        candidates: {
          create: dto.candidateIds.map((candidateId) => ({
            candidateId,
          })),
        },
      },
      include: {
        test: true,
        candidates: { include: { candidate: true } },
        createdBy: true,
      },
    });

    return this.formatScheduledExam(scheduled);
  }

  // ========================================
  // EXAMINER: Listar mis examenes programados
  // ========================================
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async findAll(@CurrentUser() user: any) {
    const where = ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'].includes(user.role)
      ? {}
      : { createdById: user.id };

    const exams = await this.prisma.scheduledExam.findMany({
      where,
      include: {
        test: true,
        candidates: { include: { candidate: true } },
        createdBy: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });

    return exams.map((e) => this.formatScheduledExam(e));
  }

  // ========================================
  // EXAMINER: Ver detalle de un examen
  // ========================================
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const exam = await this.prisma.scheduledExam.findUnique({
      where: { id },
      include: {
        test: true,
        candidates: { include: { candidate: true } },
        createdBy: true,
      },
    });

    if (!exam) throw new NotFoundException('Examen programado no encontrado');

    // EXAMINER solo puede ver los suyos. ADMIN/SUPER_ADMIN/AUDITOR ven todo.
    if (user.role === Role.EXAMINER && exam.createdById !== user.id) {
      throw new ForbiddenException('No tienes permiso para ver este examen');
    }
    return this.formatScheduledExam(exam);
  }

  // ========================================
  // EXAMINER: Editar examen programado
  // ========================================
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledExamDto,
    @CurrentUser() user: any,
  ) {
    const exam = await this.prisma.scheduledExam.findUnique({
      where: { id },
      include: { candidates: true },
    });
    if (!exam) throw new NotFoundException('Examen programado no encontrado');

    if (exam.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Solo se puede editar un examen que aun no ha iniciado (estado PROGRAMADO)',
      );
    }

    if (
      exam.createdById !== user.id &&
      !['SUPER_ADMIN', 'ADMIN'].includes(user.role)
    ) {
      throw new ForbiddenException('No tienes permiso para editar este examen');
    }

    if (dto.scheduledAt) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt <= new Date()) {
        throw new BadRequestException(
          'La fecha programada debe ser en el futuro',
        );
      }
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined)
      updateData.description = dto.description || null;
    if (dto.scheduledAt !== undefined)
      updateData.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMin !== undefined) updateData.durationMin = dto.durationMin;

    if (dto.candidateIds !== undefined) {
      for (const candidateId of dto.candidateIds) {
        const candidate = await this.userRepository.findById(candidateId);
        if (!candidate)
          throw new NotFoundException(
            `Candidato con ID ${candidateId} no encontrado`,
          );
        if (candidate.role.toString() !== 'CANDIDATE') {
          throw new BadRequestException(
            `El usuario ${candidate.email} no tiene rol de candidato`,
          );
        }
      }

      await this.prisma.scheduledExamCandidate.deleteMany({
        where: { scheduledExamId: id },
      });

      updateData.candidates = {
        create: dto.candidateIds.map((candidateId) => ({
          candidateId,
        })),
      };
    }

    const updated = await this.prisma.scheduledExam.update({
      where: { id },
      data: updateData,
      include: {
        test: true,
        candidates: { include: { candidate: true } },
        createdBy: true,
      },
    });

    return this.formatScheduledExam(updated);
  }

  // ========================================
  // EXAMINER: Cancelar examen
  // ========================================
  @Patch(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const exam = await this.prisma.scheduledExam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException('Examen programado no encontrado');

    // EXAMINER solo puede cancelar los suyos.
    if (user.role === Role.EXAMINER && exam.createdById !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para cancelar este examen',
      );
    }

    if (exam.status === 'COMPLETED' || exam.status === 'CANCELLED') {
      throw new BadRequestException(
        'Este examen ya fue completado o cancelado',
      );
    }

    const updated = await this.prisma.scheduledExam.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        test: true,
        candidates: { include: { candidate: true } },
        createdBy: true,
      },
    });

    return this.formatScheduledExam(updated);
  }

  // ========================================
  // CANDIDATE: Ver mis examenes programados
  // ========================================
  @Get('my/assigned')
  @Roles(Role.CANDIDATE)
  async getMyAssignments(@CurrentUser() user: any) {
    const assignments = await this.prisma.scheduledExamCandidate.findMany({
      where: { candidateId: user.id },
      include: {
        scheduledExam: {
          include: {
            test: true,
            createdBy: true,
          },
        },
      },
      orderBy: { scheduledExam: { scheduledAt: 'asc' } },
    });

    return assignments.map((a) => ({
      id: a.id,
      status: a.status,
      startedAt: a.startedAt,
      finishedAt: a.finishedAt,
      sessionId: a.sessionId,
      scheduledExam: {
        id: a.scheduledExam.id,
        title: a.scheduledExam.title,
        description: a.scheduledExam.description,
        scheduledAt: a.scheduledExam.scheduledAt,
        durationMin: a.scheduledExam.durationMin,
        status: a.scheduledExam.status,
        isBattery: !a.scheduledExam.testId,
        testTypes:
          (a.scheduledExam as any).testTypes?.length > 0
            ? (a.scheduledExam as any).testTypes
            : ['KOSTICK', 'VALANTI', 'DISC', 'PF16'],
        test: a.scheduledExam.test
          ? {
              id: a.scheduledExam.test.id,
              name: a.scheduledExam.test.name,
              type: a.scheduledExam.test.type,
              timeLimitMin: a.scheduledExam.test.timeLimitMin,
              totalQuestions: a.scheduledExam.test.totalQuestions,
            }
          : null,
        examiner: `${a.scheduledExam.createdBy.firstName} ${a.scheduledExam.createdBy.lastName}`,
      },
    }));
  }

  // ========================================
  // CANDIDATE: Ingresar a examen programado (bateria)
  // ========================================
  @Post(':id/enter')
  @Roles(Role.CANDIDATE)
  async enterExam(
    @Param('id') scheduledExamId: string,
    @CurrentUser() user: any,
  ) {
    const assignment = await this.prisma.scheduledExamCandidate.findFirst({
      where: { scheduledExamId, candidateId: user.id },
      include: {
        scheduledExam: true,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'No estas asignado a este examen. Contacta al examinador.',
      );
    }

    if (assignment.status !== 'ASSIGNED') {
      // If already started, return existing sessions
      if (assignment.status === 'STARTED') {
        const existingSessions = await this.prisma.examSession.findMany({
          where: { scheduledExamId, candidateId: user.id },
          include: { test: true },
          orderBy: { createdAt: 'asc' },
        });
        const firstActive = existingSessions.find(
          (s) => s.status === 'IN_PROGRESS' || s.status === 'PENDING',
        );
        if (firstActive) {
          return {
            message: 'Sesion existente encontrada. Continuando examen.',
            sessionId: firstActive.id,
            scheduledExamId,
          };
        }
      }
      throw new BadRequestException(
        'Ya completaste este examen o fuiste marcado como ausente.',
      );
    }

    const exam = assignment.scheduledExam;
    const now = new Date();
    const scheduledAt = new Date(exam.scheduledAt);
    const endsAt = new Date(
      scheduledAt.getTime() + exam.durationMin * 60 * 1000,
    );

    if (exam.status === 'CANCELLED') {
      throw new BadRequestException(
        'Este examen fue cancelado por el examinador.',
      );
    }

    // Candidates can enter from scheduledAt until endsAt
    if (now < scheduledAt) {
      const diffMin = Math.ceil(
        (scheduledAt.getTime() - now.getTime()) / 60000,
      );
      throw new BadRequestException(
        `El examen aun no ha comenzado. Podras ingresar a las ${scheduledAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}. Faltan ${diffMin} minutos.`,
      );
    }

    if (now > endsAt) {
      await this.prisma.scheduledExamCandidate.update({
        where: { id: assignment.id },
        data: { status: 'ABSENT' },
      });
      throw new ForbiddenException(
        'La ventana del examen ha finalizado. Fuiste marcado como AUSENTE porque no ingresaste a tiempo.',
      );
    }

    // Calculate remaining time: from now until endsAt
    const remainingMinutes = Math.floor(
      (endsAt.getTime() - now.getTime()) / 60000,
    );

    // Determinar los tests de esta sesión (del exam o la batería completa si es legacy)
    const examTestTypes: string[] =
      exam.testTypes && (exam as any).testTypes.length > 0
        ? (exam as any).testTypes
        : [...BATTERY_ORDER];

    // Encontrar los tests activos en el orden correcto
    const tests = await this.prisma.test.findMany({
      where: { isActive: true, type: { in: examTestTypes as any[] } },
    });
    const testsByType = new Map<string, (typeof tests)[0]>(tests.map((t) => [t.type as string, t]));
    // Preservar el orden de BATTERY_ORDER para los tipos seleccionados
    const orderedTypes = [...BATTERY_ORDER].filter((t) =>
      examTestTypes.includes(t),
    );
    const missing = orderedTypes.filter((type) => !testsByType.has(type));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Error de configuracion: faltan tests activos para ${missing.join(', ')}. Contacta al administrador.`,
      );
    }

    // Crear ExamSessions — primera IN_PROGRESS, resto PENDING
    const sessions: { id: string; testType: string; status: string }[] = [];
    for (let i = 0; i < orderedTypes.length; i++) {
      const testType = orderedTypes[i];
      const test = testsByType.get(testType)!;
      const session = await this.prisma.examSession.create({
        data: {
          testId: test.id,
          candidateId: user.id,
          examinerId: exam.createdById,
          scheduledExamId: exam.id,
          status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
          startedAt: i === 0 ? now : null,
          currentQuestion: i === 0 ? 1 : 0,
        },
      });
      sessions.push({ id: session.id, testType, status: session.status });
    }

    // Update assignment
    await this.prisma.scheduledExamCandidate.update({
      where: { id: assignment.id },
      data: {
        status: 'STARTED',
        startedAt: now,
        sessionId: sessions[0].id,
      },
    });

    // Mark exam as ACTIVE if first candidate
    if (exam.status === 'SCHEDULED') {
      await this.prisma.scheduledExam.update({
        where: { id: exam.id },
        data: { status: 'ACTIVE' },
      });
    }

    return {
      message: `Ingreso exitoso. Se han creado ${sessions.length} evaluacion(es).`,
      sessionId: sessions[0].id,
      scheduledExamId: exam.id,
      remainingMinutes,
      totalTests: sessions.length,
      sessions,
    };
  }

  // ========================================
  // EXAMINER / ADMIN / AUDITOR: Ranking IAP de la sesion
  // Listado de evaluados con puntaje cuantitativo + apto/no apto.
  // ========================================
  @Get(':id/ranking')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getRanking(
    @Param('id') scheduledExamId: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.loadRankingData(scheduledExamId, user);
    // Para la respuesta JSON del ranking no exponemos fortalezas/riesgos/
    // observaciones completas (van en /report.docx y en /candidates/:id).
    return {
      scheduledExam: data.scheduledExam,
      summary: data.summary,
      ranking: data.ranking.map((r) => ({
        rank: r.rank,
        candidate: r.candidate,
        assignmentStatus: r.assignmentStatus,
        batteryComplete: r.batteryComplete,
        disqualified: r.disqualified,
        iapScore: r.iapScore,
        iapBreakdown: r.iapBreakdown,
        dictamen: r.dictamen,
        dictamenLabel: r.dictamenLabel,
        apto: r.apto,
        calificacion: r.calificacion,
        invalidated: r.invalidated,
        invalidationReasons: r.invalidationReasons,
        resumen: r.resumen,
        generatedAt: r.generatedAt,
      })),
    };
  }

  // ========================================
  // EXAMINER / ADMIN / AUDITOR: Descargar reporte DOCX con hallazgos
  // ========================================
  @Get(':id/report.docx')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async downloadReportDocx(
    @Param('id') scheduledExamId: string,
    @CurrentUser() user: any,
    @Res() res: import('express').Response,
  ) {
    const data = await this.loadRankingData(scheduledExamId, user);
    const buffer = await this.iapReportService.buildDocx(data);
    const safeTitle = (data.scheduledExam.title || 'reporte')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .slice(0, 80);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_iap_${safeTitle}.docx"`,
    );
    res.send(buffer);
  }

  private async loadRankingData(scheduledExamId: string, user: any) {
    const exam = await this.prisma.scheduledExam.findUnique({
      where: { id: scheduledExamId },
      include: {
        candidates: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                cedula: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Examen programado no encontrado');
    if (user.role === Role.EXAMINER && exam.createdById !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para ver el ranking de este examen',
      );
    }

    const recommendations = await (
      this.prisma as any
    ).aiRecommendation.findMany({
      where: { scheduledExamId },
    });
    const recByCandidate = new Map<string, any>(
      recommendations.map((r: any) => [r.candidateId, r]),
    );

    const candidateIds = exam.candidates.map((c) => c.candidateId);
    const sessions = await this.prisma.examSession.findMany({
      where: {
        scheduledExamId,
        candidateId: { in: candidateIds },
      },
      select: {
        candidateId: true,
        status: true,
        test: { select: { type: true } },
      },
    });
    const sessionsByCandidate = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsByCandidate.get(s.candidateId) || [];
      arr.push(s);
      sessionsByCandidate.set(s.candidateId, arr);
    }

    const dictamenLabel: Record<string, string> = {
      APTO_EXCELENTE: 'Apto / Excelente ajuste',
      APTO_CON_RESERVAS: 'Apto con reservas',
      NO_APTO_DESARROLLABLE: 'No apto (desarrollable)',
      NO_APTO_RIESGO: 'No apto (riesgo)',
      PRUEBA_INVALIDADA: 'Prueba invalidada',
    };

    const examTestTypes: string[] =
      (exam as any).testTypes && (exam as any).testTypes.length > 0
        ? (exam as any).testTypes
        : ['KOSTICK', 'VALANTI', 'DISC', 'PF16'];

    const rows = exam.candidates.map((c) => {
      const rec = recByCandidate.get(c.candidateId);
      const sess = sessionsByCandidate.get(c.candidateId) || [];
      const completedTypes = new Set(
        sess.filter((s) => s.status === 'COMPLETED').map((s) => s.test.type),
      );
      const batteryComplete = examTestTypes.every((t) =>
        completedTypes.has(t as any),
      );
      const disqualified = sess.some((s) => s.status === 'DISQUALIFIED');

      const iapScore: number | null = rec?.iapScore ?? null;
      const dictamen: string | null = rec?.dictamen ?? null;
      const apto =
        dictamen === 'APTO_EXCELENTE' || dictamen === 'APTO_CON_RESERVAS';

      return {
        candidate: c.candidate,
        assignmentStatus: c.status,
        batteryComplete,
        disqualified,
        iapScore,
        iapBreakdown: rec?.iapBreakdown ?? null,
        dictamen,
        dictamenLabel: dictamen ? dictamenLabel[dictamen] : null,
        apto: dictamen ? apto : null,
        calificacion: rec?.calificacion ?? null,
        invalidated: rec?.invalidated ?? false,
        invalidationReasons: rec?.invalidationReasons ?? [],
        resumen: rec?.resumen ?? null,
        fortalezas: (rec?.fortalezas ?? []) as string[],
        riesgos: (rec?.riesgos ?? []) as string[],
        observaciones: (rec?.observaciones ?? []) as string[],
        generatedAt: rec?.createdAt ?? null,
      };
    });

    rows.sort((a, b) => {
      if (a.invalidated !== b.invalidated) return a.invalidated ? 1 : -1;
      const sa = a.iapScore;
      const sb = b.iapScore;
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sb - sa;
    });

    const ranked = rows.map((r, i) => ({
      rank: r.iapScore != null && !r.invalidated ? i + 1 : null,
      ...r,
    }));
    const aptos = ranked.filter((r) => r.apto === true).length;
    const noAptos = ranked.filter((r) => r.apto === false).length;

    return {
      scheduledExam: {
        id: exam.id,
        title: exam.title,
        scheduledAt: exam.scheduledAt,
        status: exam.status,
      },
      summary: {
        total: ranked.length,
        evaluated: ranked.filter((r) => r.iapScore != null).length,
        aptos,
        noAptos,
        pendientes: ranked.filter((r) => r.iapScore == null).length,
      },
      ranking: ranked,
    };
  }

  // ========================================
  // EXAMINER / ADMIN: Regenerar IA para TODOS los candidatos del examen
  // con bateria completa. Util para refrescar reportes viejos al modelo
  // cuantitativo IAP.
  // ========================================
  @Post(':id/regenerate-ai')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async regenerateAi(
    @Param('id') scheduledExamId: string,
    @CurrentUser() user: any,
  ) {
    const exam = await this.prisma.scheduledExam.findUnique({
      where: { id: scheduledExamId },
      include: {
        candidates: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Examen programado no encontrado');
    if (user.role === Role.EXAMINER && exam.createdById !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para regenerar las recomendaciones de este examen',
      );
    }

    const results: {
      candidateId: string;
      candidateName: string;
      status: 'GENERATED' | 'SKIPPED_INCOMPLETE' | 'ERROR';
      iapScore?: number;
      dictamen?: string;
      reason?: string;
    }[] = [];

    for (const ec of exam.candidates) {
      const candidateId = ec.candidateId;
      const candidateName = `${ec.candidate.firstName} ${ec.candidate.lastName}`;

      // Solo sesiones COMPLETED de este examen programado.
      const sessions: any[] = await this.prisma.examSession.findMany({
        where: {
          candidateId,
          scheduledExamId,
          status: SessionStatus.COMPLETED,
        },
        select: {
          id: true,
          timeSpentSec: true,
          scheduledExamId: true,
          test: {
            select: { id: true, name: true, type: true, timeLimitMin: true },
          },
          result: {
            select: {
              scaleResults: {
                select: {
                  rawScore: true,
                  stenScore: true,
                  category: true,
                  scale: {
                    select: { code: true, name: true, maxScore: true },
                  },
                },
              },
            },
          },
          _count: { select: { alerts: true } },
        },
      });

      const examTestTypes: string[] =
        (exam as any).testTypes && (exam as any).testTypes.length > 0
          ? (exam as any).testTypes
          : [...BATTERY_ORDER];

      const completedTypes = new Set(sessions.map((s: any) => s.test.type));
      const batteryComplete = examTestTypes.every((t) =>
        completedTypes.has(t),
      );

      if (!batteryComplete) {
        results.push({
          candidateId,
          candidateName,
          status: 'SKIPPED_INCOMPLETE',
          reason: `Tests incompletos. Requeridos: ${examTestTypes.join(', ')}`,
        });
        continue;
      }

      try {
        const orderedTypes = [...BATTERY_ORDER].filter((t) =>
          examTestTypes.includes(t),
        ) as typeof BATTERY_ORDER[number][];
        const testsInput = orderedTypes.map((testType) => {
          const session = sessions.find((s: any) => s.test.type === testType)!;
          return {
            testType,
            testName: session.test.name,
            timeSpentSec: session.timeSpentSec,
            timeLimitMin: session.test.timeLimitMin,
            alertCount: session._count?.alerts ?? 0,
            scales: (session.result?.scaleResults || []).map((sr: any) => ({
              code: sr.scale.code,
              name: sr.scale.name,
              rawScore: sr.rawScore,
              maxScore: sr.scale.maxScore,
              stenScore: sr.stenScore,
              category: sr.category,
            })),
          };
        });

        const { result, prompt, rawResponse } =
          await this.deepseekService.generate(candidateName, testsInput);

        await (this.prisma as any).aiRecommendation.upsert({
          where: {
            candidateId_scheduledExamId: {
              candidateId,
              scheduledExamId,
            },
          },
          create: {
            candidateId,
            scheduledExamId,
            calificacion: result.calificacion,
            resumen: result.resumen,
            fortalezas: result.fortalezas,
            riesgos: result.riesgos,
            observaciones: result.observaciones,
            iapScore: result.iapScore,
            iapBreakdown: result.iapBreakdown as any,
            dictamen: result.dictamen,
            invalidated: result.invalidated,
            invalidationReasons: result.invalidationReasons,
            rawPrompt: prompt,
            rawResponse,
            model: 'deepseek-chat',
          },
          update: {
            calificacion: result.calificacion,
            resumen: result.resumen,
            fortalezas: result.fortalezas,
            riesgos: result.riesgos,
            observaciones: result.observaciones,
            iapScore: result.iapScore,
            iapBreakdown: result.iapBreakdown as any,
            dictamen: result.dictamen,
            invalidated: result.invalidated,
            invalidationReasons: result.invalidationReasons,
            rawPrompt: prompt,
            rawResponse,
            model: 'deepseek-chat',
          },
        });

        results.push({
          candidateId,
          candidateName,
          status: 'GENERATED',
          iapScore: result.iapScore,
          dictamen: result.dictamen,
        });
      } catch (err) {
        this.logger.error(
          `Error regenerando IA para ${candidateId}: ${(err as Error)?.message}`,
        );
        results.push({
          candidateId,
          candidateName,
          status: 'ERROR',
          reason: (err as Error)?.message || 'Error desconocido',
        });
      }
    }

    const summary = {
      total: results.length,
      generated: results.filter((r) => r.status === 'GENERATED').length,
      skipped: results.filter((r) => r.status === 'SKIPPED_INCOMPLETE').length,
      errors: results.filter((r) => r.status === 'ERROR').length,
    };

    const now = new Date();
    await this.prisma.scheduledExam.update({
      where: { id: scheduledExamId },
      data: { aiRegeneratedAt: now, aiRegeneratedById: user.id },
    });

    this.logger.log(
      `Regenerate AI scheduledExamId=${scheduledExamId}: ${JSON.stringify(summary)}`,
    );

    return { summary, results, aiRegeneratedAt: now.toISOString(), aiRegeneratedById: user.id };
  }

  // ========================================
  // Helpers
  // ========================================
  private formatScheduledExam(exam: any) {
    const scheduledAt = new Date(exam.scheduledAt);
    const endsAt = new Date(
      scheduledAt.getTime() + exam.durationMin * 60 * 1000,
    );

    const examTestTypes: string[] =
      exam.testTypes && exam.testTypes.length > 0
        ? exam.testTypes
        : [...BATTERY_ORDER];

    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      scheduledAt: exam.scheduledAt,
      endsAt: endsAt.toISOString(),
      durationMin: exam.durationMin,
      status: exam.status,
      createdAt: exam.createdAt,
      isBattery: !exam.testId,
      testTypes: examTestTypes,
      test: exam.test
        ? {
            id: exam.test.id,
            name: exam.test.name,
            type: exam.test.type,
            timeLimitMin: exam.test.timeLimitMin,
          }
        : null,
      examiner: {
        id: exam.createdBy.id,
        name: `${exam.createdBy.firstName} ${exam.createdBy.lastName}`,
      },
      candidates:
        exam.candidates?.map((c: any) => ({
          id: c.id,
          status: c.status,
          startedAt: c.startedAt,
          finishedAt: c.finishedAt,
          sessionId: c.sessionId,
          candidate: {
            id: c.candidate.id,
            firstName: c.candidate.firstName,
            lastName: c.candidate.lastName,
            cedula: c.candidate.cedula,
            email: c.candidate.email,
          },
        })) || [],
      totalCandidates: exam.candidates?.length || 0,
      startedCount:
        exam.candidates?.filter((c: any) => c.status !== 'ASSIGNED').length ||
        0,
      completedCount:
        exam.candidates?.filter((c: any) => c.status === 'COMPLETED').length ||
        0,
      absentCount:
        exam.candidates?.filter((c: any) => c.status === 'ABSENT').length || 0,
    };
  }
}
