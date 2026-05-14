import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import {
  CreateJobPostingDto,
  UpdateJobPostingStatusDto,
  SendCredentialsBulkDto,
} from '../../application/dtos';
import { PdfTextExtractorService } from '../../application/services/pdf-text-extractor.service';
import type { IStorageService } from '../../application/ports/storage.port';
import { STORAGE_SERVICE } from '../../application/ports/storage.port';
import {
  EMAIL_SERVICE,
  type IEmailService,
} from '../../infrastructure/services/email.service';
import type { IUserRepository } from '../../domain/repositories';
import { USER_REPOSITORY } from '../../domain/repositories';

const ATS_BUCKET = process.env.MINIO_ATS_BUCKET || 'ats';

@Controller('job-postings')
export class JobPostingsController {
  private readonly logger = new Logger(JobPostingsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExtractor: PdfTextExtractorService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // CREATE — admin sube perfil del puesto en PDF + define preguntas
  // ──────────────────────────────────────────────────────────────
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('jobProfile', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new BadRequestException('El perfil debe ser un PDF'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('payload') payloadJson: string,
    @CurrentUser() user: any,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('El archivo del perfil del puesto es obligatorio');
    }
    if (!payloadJson) {
      throw new BadRequestException('Falta el payload de la convocatoria');
    }

    let dto: CreateJobPostingDto;
    try {
      dto = JSON.parse(payloadJson);
    } catch {
      throw new BadRequestException('Payload JSON invalido');
    }

    if (!dto.title || !dto.responsibleEmail || !Array.isArray(dto.questions) || dto.questions.length !== 2) {
      throw new BadRequestException(
        'Se requieren title, responsibleEmail y exactamente 2 preguntas de filtro',
      );
    }
    for (const q of dto.questions) {
      if (!q.options.includes(q.correctOption)) {
        throw new BadRequestException(
          `La opcion correcta de la pregunta ${q.order} no esta en las opciones`,
        );
      }
    }

    // Generar slug unico (8 chars hex)
    let slug = randomBytes(4).toString('hex');
    while (await this.prisma.jobPosting.findUnique({ where: { slug } })) {
      slug = randomBytes(4).toString('hex');
    }

    // Subir PDF del perfil a MinIO
    const key = `postings/${slug}/profile-${Date.now()}.pdf`;
    const jobProfileUrl = await this.storage.uploadFile(
      ATS_BUCKET,
      key,
      file.buffer,
      'application/pdf',
      file.size,
    );

    // Extraer texto del PDF (cache)
    const jobProfileText = await this.pdfExtractor.extractText(file.buffer);

    const posting = await this.prisma.jobPosting.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description || null,
        jobProfileUrl,
        jobProfileText: jobProfileText || null,
        topCandidatesCount: dto.topCandidatesCount,
        responsibleEmail: dto.responsibleEmail,
        createdById: user.id,
        questions: {
          create: dto.questions.map((q) => ({
            order: q.order,
            questionText: q.questionText,
            options: q.options,
            correctOption: q.correctOption,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return this.formatPosting(posting);
  }

  // ──────────────────────────────────────────────────────────────
  // LIST
  // ──────────────────────────────────────────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findAll() {
    const postings = await this.prisma.jobPosting.findMany({
      include: {
        _count: { select: { applications: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return postings.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      topCandidatesCount: p.topCandidatesCount,
      responsibleEmail: p.responsibleEmail,
      totalApplications: p._count.applications,
      createdAt: p.createdAt,
      createdBy: `${p.createdBy.firstName} ${p.createdBy.lastName}`,
    }));
  }

  // ──────────────────────────────────────────────────────────────
  // DETAIL — incluye ranking + analytics
  // ──────────────────────────────────────────────────────────────
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findOne(@Param('id') id: string) {
    const posting = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!posting) throw new NotFoundException('Convocatoria no encontrada');

    const applications = await this.prisma.jobApplication.findMany({
      where: { jobPostingId: id },
      include: {
        academicTitles: true,
        experiences: true,
        answers: { include: { question: true } },
      },
      orderBy: [{ aiScore: 'desc' }, { createdAt: 'asc' }],
    });

    const ranking = applications.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      cedula: a.cedula,
      email: a.email,
      residenceCity: a.residenceCity,
      residenceProvince: a.residenceProvince,
      birthDate: a.birthDate,
      aiScore: a.aiScore,
      aiJustification: a.aiJustification,
      status: a.status,
      filteredOutReason: a.filteredOutReason,
      emailSentAt: a.emailSentAt,
      cvUrl: a.cvUrl,
      createdAt: a.createdAt,
      academicTitles: a.academicTitles,
      experiences: a.experiences,
    }));

    // Analytics
    const total = applications.length;
    const aiScores = applications
      .map((a) => a.aiScore)
      .filter((s): s is number => typeof s === 'number');
    const avgScore = aiScores.length > 0
      ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length)
      : 0;

    const histogram = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
    for (const s of aiScores) {
      const bucket = Math.min(4, Math.floor((s - 1) / 20));
      histogram[bucket]++;
    }

    // Distribucion por provincia / ciudad
    const byProvince: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    for (const a of applications) {
      const prov = (a.residenceProvince || 'Sin dato').trim();
      const city = (a.residenceCity || 'Sin dato').trim();
      byProvince[prov] = (byProvince[prov] || 0) + 1;
      byCity[city] = (byCity[city] || 0) + 1;
    }

    // Distribucion por edad
    const ageBuckets = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 };
    const now = new Date();
    for (const a of applications) {
      const age = Math.floor(
        (now.getTime() - new Date(a.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      );
      if (age <= 25) ageBuckets['18-25']++;
      else if (age <= 35) ageBuckets['26-35']++;
      else if (age <= 45) ageBuckets['36-45']++;
      else if (age <= 55) ageBuckets['46-55']++;
      else ageBuckets['56+']++;
    }

    // Distribucion por nivel academico (toma el mas alto por candidato)
    const levelOrder = ['BACHILLERATO', 'TECNICO', 'TECNOLOGICO', 'PREGRADO', 'POSTGRADO', 'MAESTRIA', 'DOCTORADO', 'OTRO'];
    const byLevel: Record<string, number> = {};
    for (const a of applications) {
      const highest = a.academicTitles.reduce((best, t) => {
        const idx = levelOrder.indexOf(t.level);
        const bestIdx = best ? levelOrder.indexOf(best) : -1;
        return idx > bestIdx ? t.level : best;
      }, '' as string);
      const key = highest || 'OTRO';
      byLevel[key] = (byLevel[key] || 0) + 1;
    }

    // Tasa de descarte por pregunta
    const filterStats: Record<number, { total: number; failed: number; questionText: string }> = {};
    for (const q of posting.questions) {
      filterStats[q.order] = { total: 0, failed: 0, questionText: q.questionText };
    }
    for (const a of applications) {
      for (const ans of a.answers) {
        const order = ans.question.order;
        if (filterStats[order]) {
          filterStats[order].total++;
          if (!ans.isCorrect) filterStats[order].failed++;
        }
      }
    }

    // Postulaciones por dia (ultimos 30 dias)
    const series: { date: string; count: number }[] = [];
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const byDay: Record<string, number> = {};
    for (const a of applications) {
      const d = new Date(a.createdAt);
      if (d < cutoff) continue;
      const key = d.toISOString().slice(0, 10);
      byDay[key] = (byDay[key] || 0) + 1;
    }
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: byDay[key] || 0 });
    }

    const aptos = applications.filter((a) => a.status === 'EVALUATED' || a.status === 'EMAIL_SENT' || a.status === 'CONVERTED').length;
    const descartados = applications.filter((a) => a.status === 'FILTERED_OUT').length;
    const pendientes = applications.filter((a) => a.status === 'PENDING').length;

    return {
      posting: this.formatPosting(posting),
      ranking,
      analytics: {
        total,
        aptos,
        descartados,
        pendientes,
        avgScore,
        histogram,
        byProvince,
        byCity,
        byLevel,
        ageBuckets,
        filterStats,
        series,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────
  // UPDATE STATUS — abrir, cerrar, archivar
  // ──────────────────────────────────────────────────────────────
  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateJobPostingStatusDto,
  ) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!posting) throw new NotFoundException('Convocatoria no encontrada');
    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ──────────────────────────────────────────────────────────────
  // GET CV URL — firma URL para descargar PDF de MinIO
  // ──────────────────────────────────────────────────────────────
  @Get('applications/:applicationId/cv-url')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getCvUrl(@Param('applicationId') applicationId: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: { cvUrl: true },
    });
    if (!app) throw new NotFoundException('Postulacion no encontrada');
    const [bucket, ...keyParts] = app.cvUrl.split('/');
    const key = keyParts.join('/');
    if (bucket !== ATS_BUCKET) {
      throw new BadRequestException('Bucket invalido');
    }
    const url = await this.storage.getFileUrl(bucket, key);
    return { url };
  }

  // ──────────────────────────────────────────────────────────────
  // GET JOB PROFILE URL
  // ──────────────────────────────────────────────────────────────
  @Get(':id/profile-url')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getJobProfileUrl(@Param('id') id: string) {
    const posting = await this.prisma.jobPosting.findUnique({
      where: { id },
      select: { jobProfileUrl: true },
    });
    if (!posting) throw new NotFoundException('Convocatoria no encontrada');
    const [bucket, ...keyParts] = posting.jobProfileUrl.split('/');
    const key = keyParts.join('/');
    if (bucket !== ATS_BUCKET) {
      throw new BadRequestException('Bucket invalido');
    }
    const url = await this.storage.getFileUrl(bucket, key);
    return { url };
  }

  // ──────────────────────────────────────────────────────────────
  // SEND CREDENTIALS — envia credenciales a una postulacion especifica.
  // Crea User CANDIDATE con password temporal y envia email.
  // ──────────────────────────────────────────────────────────────
  @Post('applications/:applicationId/send-credentials')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async sendCredentials(@Param('applicationId') applicationId: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { jobPosting: true },
    });
    if (!app) throw new NotFoundException('Postulacion no encontrada');
    if (app.status === 'FILTERED_OUT') {
      throw new BadRequestException('No se puede enviar credenciales a una postulacion descartada');
    }
    if (app.status === 'EMAIL_SENT' || app.status === 'CONVERTED') {
      throw new BadRequestException('Las credenciales ya fueron enviadas');
    }

    const result = await this.provisionCandidateAndEmail(app);
    return result;
  }

  // ──────────────────────────────────────────────────────────────
  // BULK SEND — envia a los top N (default = topCandidatesCount).
  // Se omiten descartados y los que ya recibieron email.
  // ──────────────────────────────────────────────────────────────
  @Post(':id/send-credentials-bulk')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async sendCredentialsBulk(
    @Param('id') id: string,
    @Body() dto: SendCredentialsBulkDto,
  ) {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!posting) throw new NotFoundException('Convocatoria no encontrada');

    let candidates: any[] = [];
    if (dto.applicationIds && dto.applicationIds.length > 0) {
      candidates = await this.prisma.jobApplication.findMany({
        where: {
          id: { in: dto.applicationIds },
          jobPostingId: id,
          status: { in: ['EVALUATED', 'PENDING'] },
        },
        include: { jobPosting: true },
      });
    } else {
      const topN = dto.topN ?? posting.topCandidatesCount;
      candidates = await this.prisma.jobApplication.findMany({
        where: {
          jobPostingId: id,
          status: { in: ['EVALUATED', 'PENDING'] },
          aiScore: { not: null },
        },
        include: { jobPosting: true },
        orderBy: [{ aiScore: 'desc' }, { createdAt: 'asc' }],
        take: topN,
      });
    }

    const results: { applicationId: string; status: 'SENT' | 'SKIPPED' | 'ERROR'; reason?: string }[] = [];
    for (const app of candidates) {
      try {
        await this.provisionCandidateAndEmail(app);
        results.push({ applicationId: app.id, status: 'SENT' });
      } catch (err) {
        results.push({
          applicationId: app.id,
          status: 'ERROR',
          reason: (err as Error).message,
        });
      }
    }

    return {
      summary: {
        total: candidates.length,
        sent: results.filter((r) => r.status === 'SENT').length,
        errors: results.filter((r) => r.status === 'ERROR').length,
      },
      results,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────
  private async provisionCandidateAndEmail(app: any) {
    // Verificar si ya existe User con esa cedula/email
    let user = await this.userRepository.findByEmail(app.email);
    let tempPassword: string;

    if (!user) {
      tempPassword = randomBytes(8).toString('hex');
      const hashed = await bcrypt.hash(tempPassword, 12);
      user = await this.userRepository.create({
        email: app.email,
        password: hashed,
        cedula: app.cedula,
        firstName: app.firstName,
        lastName: app.lastName,
        role: 'CANDIDATE' as any,
        mustChangePassword: true,
      } as any);
    } else {
      // Resetear password para asegurar acceso
      tempPassword = randomBytes(8).toString('hex');
      const hashed = await bcrypt.hash(tempPassword, 12);
      await this.userRepository.update(user.id, {
        password: hashed,
        mustChangePassword: true,
      } as any);
    }

    await this.emailService.sendAtsAcceptanceEmail(
      app.email,
      app.firstName,
      tempPassword,
      app.jobPosting.title,
    );

    await this.prisma.jobApplication.update({
      where: { id: app.id },
      data: {
        status: 'EMAIL_SENT',
        emailSentAt: new Date(),
        convertedUserId: user.id,
      },
    });

    this.logger.log(`ATS credentials sent to ${app.email} (application=${app.id})`);
    return { ok: true, userId: user.id, email: app.email };
  }

  private formatPosting(p: any) {
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      status: p.status,
      topCandidatesCount: p.topCandidatesCount,
      responsibleEmail: p.responsibleEmail,
      jobProfileUrl: p.jobProfileUrl,
      createdAt: p.createdAt,
      questions: p.questions?.map((q: any) => ({
        id: q.id,
        order: q.order,
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
      })),
    };
  }
}
