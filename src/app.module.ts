import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerProxyGuard } from './presentation/guards/throttler-proxy.guard';

// Infrastructure
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import {
  PrismaUserRepository,
  PrismaTestRepository,
  PrismaSessionRepository,
  PrismaAnswerRepository,
  PrismaResultRepository,
  PrismaProctoringAlertRepository,
  PrismaRecordingRepository,
  PrismaCustomQuestionRepository,
  PrismaCustomExamRepository,
  PrismaCustomExamSessionRepository,
  PrismaCustomAnswerRepository,
} from './infrastructure/persistence/prisma/repositories';
import { JwtStrategy } from './infrastructure/config/jwt.strategy';
import { MinioStorageService } from './infrastructure/services/minio-storage.service';
import { RedisCacheService } from './infrastructure/services/redis-cache.service';
import {
  EmailService,
  EMAIL_SERVICE,
} from './infrastructure/services/email.service';

// Domain repository tokens
import {
  USER_REPOSITORY,
  TEST_REPOSITORY,
  SESSION_REPOSITORY,
  ANSWER_REPOSITORY,
  RESULT_REPOSITORY,
  PROCTORING_ALERT_REPOSITORY,
  RECORDING_REPOSITORY,
  CUSTOM_QUESTION_REPOSITORY,
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_EXAM_SESSION_REPOSITORY,
  CUSTOM_ANSWER_REPOSITORY,
} from './domain/repositories';
import { STORAGE_SERVICE } from './application/ports/storage.port';
import { CACHE_SERVICE } from './application/ports/cache.port';

// Application use cases
import {
  RegisterUseCase,
  LoginUseCase,
  RefreshTokenUseCase,
  BatchCreateCandidatesUseCase,
  ChangePasswordUseCase,
} from './application/use-cases/auth';
import {
  StartExamUseCase,
  SubmitAnswerUseCase,
  FinishExamUseCase,
} from './application/use-cases/sessions';
import { CalculateResultUseCase } from './application/use-cases/results';
import {
  CreateTestUseCase,
  UpdateTestUseCase,
} from './application/use-cases/tests';
import { UpdateUserUseCase } from './application/use-cases/users';
import { CreateAlertUseCase } from './application/use-cases/proctoring';
import {
  CreateCustomQuestionUseCase,
  UpdateCustomQuestionUseCase,
  CreateCustomExamUseCase,
  UpdateCustomExamUseCase,
  AssignCandidatesUseCase,
  StartCustomExamUseCase,
  GetCurrentQuestionUseCase,
  SubmitCustomAnswerUseCase,
  FinishCustomExamUseCase,
} from './application/use-cases/custom-exams';

// Presentation
import { ProctoringController } from './presentation/controllers/proctoring.controller';
import { RecordingsController } from './presentation/controllers/recordings.controller';
import { CandidatesController } from './presentation/controllers/candidates.controller';
import { MetricsController } from './presentation/controllers/metrics.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { RecommendationService } from './application/services/recommendation.service';
import { DeepseekRecommendationService } from './application/services/deepseek-recommendation.service';
import { CvEvaluatorService } from './application/services/cv-evaluator.service';
import { PdfTextExtractorService } from './application/services/pdf-text-extractor.service';
import { JobPostingsController } from './presentation/controllers/job-postings.controller';
import { ApplicationsController } from './presentation/controllers/applications.controller';
import { ProctoringGateway } from './presentation/gateways/proctoring.gateway';
import { ReportsController } from './presentation/controllers/reports.controller';
import { ScheduledExamsController } from './presentation/controllers/scheduled-exams.controller';
import { MetricsService } from './infrastructure/services/metrics.service';
import { MetricsMiddleware } from './presentation/middleware/metrics.middleware';
import { ExcelService } from './infrastructure/services/excel.service';
import { IapReportService } from './infrastructure/services/iap-report.service';
import { VideoProcessorService } from './infrastructure/services/video-processor.service';
import { WebhookService } from './infrastructure/services/webhook.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { UsersController } from './presentation/controllers/users.controller';
import { TestsController } from './presentation/controllers/tests.controller';
import { SessionsController } from './presentation/controllers/sessions.controller';
import { CustomQuestionsController } from './presentation/controllers/custom-questions.controller';
import { CustomExamsController } from './presentation/controllers/custom-exams.controller';
import { CustomSessionsController } from './presentation/controllers/custom-sessions.controller';
import { JwtAuthGuard } from './presentation/guards/jwt.guard';
import { RolesGuard } from './presentation/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      // Lazy: lee el secret en runtime (despues de que main.ts haya validado).
      // No usa fallback inseguro; si falta JWT_SECRET, main.ts aborta antes.
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '4h') as any },
      }),
    }),
    // Rate limiting: 200 requests per minuto por IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
  ],
  controllers: [
    AuthController,
    UsersController,
    TestsController,
    SessionsController,
    ProctoringController,
    ReportsController,
    ScheduledExamsController,
    RecordingsController,
    CandidatesController,
    MetricsController,
    HealthController,
    JobPostingsController,
    ApplicationsController,
    CustomQuestionsController,
    CustomExamsController,
    CustomSessionsController,
  ],
  providers: [
    // Infrastructure
    PrismaService,
    JwtStrategy,

    // Repository bindings (domain interface -> infrastructure implementation)
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: TEST_REPOSITORY, useClass: PrismaTestRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: ANSWER_REPOSITORY, useClass: PrismaAnswerRepository },
    { provide: RESULT_REPOSITORY, useClass: PrismaResultRepository },
    {
      provide: PROCTORING_ALERT_REPOSITORY,
      useClass: PrismaProctoringAlertRepository,
    },
    { provide: RECORDING_REPOSITORY, useClass: PrismaRecordingRepository },
    {
      provide: CUSTOM_QUESTION_REPOSITORY,
      useClass: PrismaCustomQuestionRepository,
    },
    { provide: CUSTOM_EXAM_REPOSITORY, useClass: PrismaCustomExamRepository },
    {
      provide: CUSTOM_EXAM_SESSION_REPOSITORY,
      useClass: PrismaCustomExamSessionRepository,
    },
    {
      provide: CUSTOM_ANSWER_REPOSITORY,
      useClass: PrismaCustomAnswerRepository,
    },
    { provide: STORAGE_SERVICE, useClass: MinioStorageService },
    { provide: CACHE_SERVICE, useClass: RedisCacheService },
    { provide: EMAIL_SERVICE, useClass: EmailService },

    // Use cases
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    BatchCreateCandidatesUseCase,
    ChangePasswordUseCase,
    StartExamUseCase,
    SubmitAnswerUseCase,
    FinishExamUseCase,
    CalculateResultUseCase,
    CreateTestUseCase,
    UpdateTestUseCase,
    UpdateUserUseCase,
    CreateAlertUseCase,
    CreateCustomQuestionUseCase,
    UpdateCustomQuestionUseCase,
    CreateCustomExamUseCase,
    UpdateCustomExamUseCase,
    AssignCandidatesUseCase,
    StartCustomExamUseCase,
    GetCurrentQuestionUseCase,
    SubmitCustomAnswerUseCase,
    FinishCustomExamUseCase,

    // Services
    MetricsService,
    ExcelService,
    IapReportService,
    RecommendationService,
    DeepseekRecommendationService,
    CvEvaluatorService,
    PdfTextExtractorService,
    VideoProcessorService,
    WebhookService,

    // WebSocket
    ProctoringGateway,

    // Global guards
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerProxyGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
