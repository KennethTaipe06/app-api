import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../../domain/enums';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { RecommendationService } from '../../application/services/recommendation.service';
import { DeepseekRecommendationService } from '../../application/services/deepseek-recommendation.service';

// Los 4 tipos de test que conforman la bateria completa
const BATTERY_TEST_TYPES = ['KOSTICK', 'VALANTI', 'DISC', 'PF16'];

@Controller('candidates')
export class CandidatesController {
  private readonly logger = new Logger(CandidatesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationService: RecommendationService,
    private readonly deepseekService: DeepseekRecommendationService,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async listCandidates() {
    const candidates = await (this.prisma as any).user.findMany({
      where: { role: 'CANDIDATE', isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        cedula: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            candidateSessions: { where: { status: 'COMPLETED' } },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    return candidates.map((c: any) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      cedula: c.cedula,
      email: c.email,
      createdAt: c.createdAt,
      completedExams: c._count.candidateSessions,
    }));
  }

  @Get(':id/dashboard')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async getCandidateDashboard(@Param('id') candidateId: string) {
    const candidate = await (this.prisma as any).user.findUnique({
      where: { id: candidateId },
      select: { id: true, firstName: true, lastName: true, cedula: true, email: true },
    });
    if (!candidate) throw new NotFoundException('Candidato no encontrado');

    // Obtener todas las sesiones (completadas y descalificadas) con alertas incluidas
    const sessions: any[] = await (this.prisma as any).examSession.findMany({
      where: { candidateId, status: { in: ['COMPLETED', 'DISQUALIFIED'] } },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        timeSpentSec: true,
        scheduledExamId: true,
        test: {
          select: { id: true, name: true, type: true, timeLimitMin: true, totalQuestions: true },
        },
        result: {
          select: {
            id: true,
            totalScore: true,
            scaleResults: {
              select: {
                rawScore: true, stenScore: true, category: true,
                scale: { select: { code: true, name: true, maxScore: true } },
              },
            },
          },
        },
        recordings: {
          select: { id: true, type: true, durationSec: true, sizeBytes: true, createdAt: true },
        },
        alerts: {
          select: { id: true, type: true, data: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    // Agrupar por scheduledExamId (null = sesion standalone)
    const groupMap = new Map<string, any[]>();
    for (const session of sessions) {
      const key = session.scheduledExamId ?? `standalone:${session.id}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(session);
    }

    // Construir grupos enriquecidos
    const examSessions: any[] = [];

    for (const [key, groupSessions] of groupMap) {
      const scheduledExamId = groupSessions[0].scheduledExamId ?? null;

      // Info del examen programado
      let scheduledExam: any = null;
      let examTestTypes: string[] = [...BATTERY_TEST_TYPES];
      if (scheduledExamId) {
        scheduledExam = await (this.prisma as any).scheduledExam.findUnique({
          where: { id: scheduledExamId },
          select: { id: true, title: true, scheduledAt: true, status: true, testTypes: true },
        });
        if (scheduledExam?.testTypes?.length > 0) {
          examTestTypes = scheduledExam.testTypes;
        }
      }

      // Grabaciones unicas de la bateria
      const seenRecordingIds = new Set<string>();
      const batteryRecordings: any[] = [];
      for (const s of groupSessions) {
        for (const r of s.recordings ?? []) {
          if (!seenRecordingIds.has(r.id)) {
            seenRecordingIds.add(r.id);
            batteryRecordings.push({ ...r, sizeBytes: r.sizeBytes?.toString() ?? null });
          }
        }
      }

      // Bateria completa para este grupo
      const completedTypes = new Set(
        groupSessions.filter((s) => s.status === 'COMPLETED').map((s: any) => s.test.type as string),
      );
      const batteryComplete = examTestTypes.every((t) => completedTypes.has(t));

      // IA para este scheduledExamId especifico
      let aiRecommendation: any = null;
      if (scheduledExamId) {
        const existing = await (this.prisma as any).aiRecommendation.findUnique({
          where: { candidateId_scheduledExamId: { candidateId, scheduledExamId } },
        });
        if (existing) {
          aiRecommendation = {
            calificacion: existing.calificacion,
            resumen: existing.resumen,
            fortalezas: existing.fortalezas,
            riesgos: existing.riesgos,
            observaciones: existing.observaciones,
            iapScore: existing.iapScore,
            iapBreakdown: existing.iapBreakdown,
            dictamen: existing.dictamen,
            invalidated: existing.invalidated,
            invalidationReasons: existing.invalidationReasons,
            generatedAt: existing.createdAt,
            model: existing.model,
          };
        }
      }

      // Examenes individuales con recomendaciones por test (reglas)
      const exams = groupSessions.map((session: any) => {
        const scaleScores = (session.result?.scaleResults ?? []).map((sr: any) => ({
          code: sr.scale.code,
          name: sr.scale.name,
          rawScore: sr.rawScore,
          maxScore: sr.scale.maxScore,
          stenScore: sr.stenScore,
          category: sr.category,
        }));
        const recommendation = session.result
          ? this.recommendationService.generate(
              session.test.type, scaleScores,
              session.timeSpentSec, session.test.timeLimitMin,
            )
          : null;

        return {
          sessionId: session.id,
          status: session.status,
          test: session.test,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          timeSpentSec: session.timeSpentSec,
          timeLimitMin: session.test.timeLimitMin,
          totalQuestions: session.test.totalQuestions,
          result: session.result
            ? { id: session.result.id, totalScore: session.result.totalScore, scaleResults: scaleScores }
            : null,
          recommendation,
          recordings: batteryRecordings,
          alertCount: session.alerts?.length ?? 0,
          alerts: (session.alerts ?? []).map((a: any) => ({
            id: a.id,
            type: a.type,
            data: a.data,
            timestamp: a.createdAt,
          })),
        };
      });

      const totalAlerts = groupSessions.reduce((sum: number, s: any) => sum + (s.alerts?.length ?? 0), 0);
      const groupDate = groupSessions[0].startedAt ?? groupSessions[0].finishedAt;

      examSessions.push({
        scheduledExamId,
        scheduledExam: scheduledExam
          ? { id: scheduledExam.id, title: scheduledExam.title, scheduledAt: scheduledExam.scheduledAt, status: scheduledExam.status, testTypes: examTestTypes }
          : null,
        date: groupDate,
        batteryComplete,
        aiRecommendation,
        totalAlerts,
        exams,
      });
    }

    // Mas reciente primero
    examSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { candidate, examSessions };
  }

  /**
   * Genera (o regenera) la recomendacion IA para un candidato.
   * Solo funciona si los 4 tests estan completados.
   */
  @Post(':id/ai-recommendation')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER)
  async generateAiRecommendation(
    @Param('id') candidateId: string,
    @Body() body: { scheduledExamId?: string },
  ) {
    const candidate = await (this.prisma as any).user.findUnique({
      where: { id: candidateId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!candidate) {
      throw new NotFoundException('Candidato no encontrado');
    }

    const scheduledExamId = body?.scheduledExamId || null;

    const sessionFilter: any = { candidateId, status: 'COMPLETED' };
    if (scheduledExamId) {
      sessionFilter.scheduledExamId = scheduledExamId;
    }

    const sessions: any[] = await (this.prisma as any).examSession.findMany({
      where: sessionFilter,
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

    // Determine which test types are required for this session
    let requiredTestTypes = [...BATTERY_TEST_TYPES];
    if (scheduledExamId) {
      const scheduledExam = await (this.prisma as any).scheduledExam.findUnique({
        where: { id: scheduledExamId },
        select: { testTypes: true },
      });
      if (scheduledExam?.testTypes?.length > 0) {
        requiredTestTypes = scheduledExam.testTypes;
      }
    }

    const completedTestTypes = [
      ...new Set(sessions.map((s: any) => s.test.type as string)),
    ];
    const missingTests = requiredTestTypes.filter(
      (t) => !completedTestTypes.includes(t),
    );

    if (missingTests.length > 0) {
      return {
        error: true,
        message: `Faltan ${missingTests.length} test(s) por completar: ${missingTests.join(', ')}`,
        missingTests,
      };
    }

    // Construir input para DeepSeek — un registro por tipo de test
    const testsInput = requiredTestTypes.map((testType) => {
      const session = sessions.find((s: any) => s.test.type === testType);
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

    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const { result, prompt, rawResponse } = await this.deepseekService.generate(
      candidateName,
      testsInput,
    );

    const saved = await (this.prisma as any).aiRecommendation.upsert({
      where: {
        candidateId_scheduledExamId: {
          candidateId,
          scheduledExamId: scheduledExamId,
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
        rawResponse: rawResponse,
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
        rawResponse: rawResponse,
        model: 'deepseek-chat',
      },
    });

    this.logger.log(
      `Recomendacion IA generada para candidato ${candidateId}: ${result.calificacion}`,
    );

    return {
      id: saved.id,
      calificacion: result.calificacion,
      resumen: result.resumen,
      fortalezas: result.fortalezas,
      riesgos: result.riesgos,
      observaciones: result.observaciones,
      iapScore: result.iapScore,
      iapBreakdown: result.iapBreakdown,
      dictamen: result.dictamen,
      invalidated: result.invalidated,
      invalidationReasons: result.invalidationReasons,
      generatedAt: saved.createdAt,
      model: saved.model,
    };
  }
}
