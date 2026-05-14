import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import type { IStorageService } from '../../application/ports/storage.port';
import { STORAGE_SERVICE } from '../../application/ports/storage.port';
import { PdfTextExtractorService } from '../../application/services/pdf-text-extractor.service';
import { CvEvaluatorService } from '../../application/services/cv-evaluator.service';
import { validateCedulaEcuatoriana } from '../../application/utils/cedula-validator';
import type { SubmitApplicationDto } from '../../application/dtos';

const ATS_BUCKET = process.env.MINIO_ATS_BUCKET || 'ats';

@Controller('applications')
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly pdfExtractor: PdfTextExtractorService,
    private readonly cvEvaluator: CvEvaluatorService,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // PUBLIC: obtener convocatoria por slug (form data — sin correctOption)
  // ──────────────────────────────────────────────────────────────
  @Public()
  @Get('by-slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const posting = await this.prisma.jobPosting.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            questionText: true,
            options: true,
            // NO se expone correctOption
          },
        },
      },
    });
    if (!posting) throw new NotFoundException('Convocatoria no encontrada');
    if (posting.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'POSTING_INACTIVE',
        message: 'Esta convocatoria no esta recibiendo postulaciones',
        status: posting.status,
      });
    }
    return posting;
  }

  // ──────────────────────────────────────────────────────────────
  // PUBLIC: verificar si una cedula ya postulo (precheck)
  // ──────────────────────────────────────────────────────────────
  @Public()
  @Get('by-slug/:slug/check-cedula/:cedula')
  async checkCedula(
    @Param('slug') slug: string,
    @Param('cedula') cedula: string,
  ) {
    if (!validateCedulaEcuatoriana(cedula)) {
      return { valid: false, exists: false, reason: 'invalid' };
    }
    const posting = await this.prisma.jobPosting.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!posting) return { valid: true, exists: false };
    const existing = await this.prisma.jobApplication.findUnique({
      where: {
        jobPostingId_cedula: { jobPostingId: posting.id, cedula },
      },
      select: { id: true },
    });
    return { valid: true, exists: !!existing };
  }

  // ──────────────────────────────────────────────────────────────
  // PUBLIC: submit aplicacion (multipart con CV)
  // ──────────────────────────────────────────────────────────────
  @Public()
  @Post('by-slug/:slug')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 envios por minuto por IP
  @UseInterceptors(
    FileInterceptor('cv', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new BadRequestException('El CV debe ser un PDF'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async submit(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('payload') payloadJson: string,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('El CV en PDF es obligatorio');
    }
    if (!payloadJson) {
      throw new BadRequestException('Falta el payload de la postulacion');
    }

    let dto: SubmitApplicationDto;
    try {
      dto = JSON.parse(payloadJson);
    } catch {
      throw new BadRequestException('Payload JSON invalido');
    }

    // Validacion cedula
    if (!validateCedulaEcuatoriana(dto.cedula)) {
      throw new BadRequestException({
        code: 'INVALID_CEDULA',
        message: 'Numero de cedula invalido',
      });
    }

    // Buscar convocatoria
    const posting = await this.prisma.jobPosting.findUnique({
      where: { slug },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!posting) throw new NotFoundException('Convocatoria no encontrada');
    if (posting.status !== 'ACTIVE') {
      throw new BadRequestException('Esta convocatoria no esta recibiendo postulaciones');
    }

    // Unicidad por cedula en la convocatoria
    const existing = await this.prisma.jobApplication.findUnique({
      where: {
        jobPostingId_cedula: { jobPostingId: posting.id, cedula: dto.cedula },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_APPLIED',
        message: 'Ya existe una postulacion con esta cedula para esta convocatoria',
      });
    }

    // Validar respuestas a las 2 preguntas
    if (!Array.isArray(dto.answers) || dto.answers.length !== posting.questions.length) {
      throw new BadRequestException('Debe responder todas las preguntas de filtro');
    }

    const questionsById = new Map(posting.questions.map((q) => [q.id, q]));
    const filterEvaluation: { questionId: string; selectedOption: string; isCorrect: boolean }[] = [];
    let filteredOut = false;
    let filteredOutReason: string | null = null;

    for (const ans of dto.answers) {
      const q = questionsById.get(ans.questionId);
      if (!q) {
        throw new BadRequestException(`Pregunta ${ans.questionId} no pertenece a la convocatoria`);
      }
      if (!q.options.includes(ans.selectedOption)) {
        throw new BadRequestException(`Opcion invalida para la pregunta ${q.order}`);
      }
      const isCorrect = ans.selectedOption === q.correctOption;
      filterEvaluation.push({
        questionId: q.id,
        selectedOption: ans.selectedOption,
        isCorrect,
      });
      if (!isCorrect && !filteredOut) {
        filteredOut = true;
        filteredOutReason = `Pregunta ${q.order}: respuesta no admitida`;
      }
    }

    // Subir CV a MinIO
    const cvKey = `applications/${posting.slug}/${dto.cedula}-${Date.now()}.pdf`;
    const cvUrl = await this.storage.uploadFile(
      ATS_BUCKET,
      cvKey,
      file.buffer,
      'application/pdf',
      file.size,
    );

    // Extraer texto del CV (solo si pasa filtro, ahorro)
    let cvText: string | null = null;
    let aiScore: number | null = null;
    let aiJustification: string | null = null;
    let aiError: string | null = null;
    let aiEvaluatedAt: Date | null = null;

    if (!filteredOut) {
      cvText = await this.pdfExtractor.extractText(file.buffer);
      if (cvText && posting.jobProfileText) {
        try {
          const evaluation = await this.cvEvaluator.evaluateCv({
            jobTitle: posting.title,
            jobProfileText: posting.jobProfileText,
            cvText,
            candidateName: `${dto.firstName} ${dto.lastName}`,
          });
          aiScore = evaluation.score;
          aiJustification = evaluation.justification;
          aiEvaluatedAt = new Date();
        } catch (err) {
          aiError = (err as Error).message;
          this.logger.warn(
            `AI eval failed for cedula=${dto.cedula} slug=${slug}: ${aiError}`,
          );
        }
      } else if (!cvText) {
        aiError = 'No se pudo extraer texto del CV';
      } else {
        aiError = 'Sin texto del perfil del puesto para comparar';
      }
    }

    const status = filteredOut
      ? 'FILTERED_OUT'
      : aiScore != null
      ? 'EVALUATED'
      : 'PENDING';

    const ipAddress = (req.ip || req.headers['x-forwarded-for']?.toString() || '').slice(0, 64);

    const created = await this.prisma.jobApplication.create({
      data: {
        jobPostingId: posting.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        cedula: dto.cedula,
        birthDate: new Date(dto.birthDate),
        residenceCity: dto.residenceCity,
        residenceProvince: dto.residenceProvince,
        email: dto.email.toLowerCase(),
        cvUrl,
        cvText,
        aiScore,
        aiJustification,
        aiEvaluatedAt,
        aiError,
        status,
        filteredOutReason,
        ipAddress,
        fingerprint: dto.fingerprint || null,
        academicTitles: {
          create: dto.academicTitles.map((t) => ({
            title: t.title,
            institution: t.institution || null,
            year: t.year || null,
            level: (t.level || 'OTRO') as any,
          })),
        },
        experiences: {
          create: dto.experiences.map((e) => ({
            company: e.company,
            position: e.position,
            durationMonths: e.durationMonths,
            description: e.description || null,
          })),
        },
        answers: { create: filterEvaluation },
      },
    });

    return {
      id: created.id,
      status: created.status,
      filteredOut,
      filteredOutReason,
      // No se expone el score al postulante
      message: filteredOut
        ? 'Lamentablemente no cumple con los criterios iniciales de esta convocatoria.'
        : 'Postulacion recibida correctamente. Se le contactara si avanza a la siguiente etapa.',
    };
  }
}
