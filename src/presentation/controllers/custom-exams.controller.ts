import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import type {
  ICustomExamRepository,
  ICustomExamSessionRepository,
} from '../../domain/repositories';
import {
  CUSTOM_EXAM_REPOSITORY,
  CUSTOM_EXAM_SESSION_REPOSITORY,
} from '../../domain/repositories';
import {
  AssignCandidatesDto,
  CreateCustomExamDto,
  UpdateCustomExamDto,
} from '../../application/dtos';
import {
  AssignCandidatesUseCase,
  CreateCustomExamUseCase,
  UpdateCustomExamUseCase,
} from '../../application/use-cases/custom-exams';

@Controller('custom-exams')
@Roles(Role.EXAMINER, Role.ADMIN, Role.SUPER_ADMIN)
export class CustomExamsController {
  constructor(
    @Inject(CUSTOM_EXAM_REPOSITORY)
    private readonly examRepo: ICustomExamRepository,
    @Inject(CUSTOM_EXAM_SESSION_REPOSITORY)
    private readonly sessionRepo: ICustomExamSessionRepository,
    private readonly createUseCase: CreateCustomExamUseCase,
    private readonly updateUseCase: UpdateCustomExamUseCase,
    private readonly assignUseCase: AssignCandidatesUseCase,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.examRepo.findByExaminer(user.id, {
      isActive: includeInactive === 'true' ? undefined : true,
    });
  }

  @Get('ranking/global')
  async globalRanking(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100;
    return this.sessionRepo.findGlobalRanking(user.id, lim);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const exam = await this.examRepo.findByIdWithQuestions(id);
    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (exam.examinerId !== user.id) {
      throw new ForbiddenException('Este examen no es tuyo');
    }
    return exam;
  }

  @Get(':id/ranking')
  async examRanking(@Param('id') id: string, @CurrentUser() user: any) {
    const exam = await this.examRepo.findById(id);
    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (exam.examinerId !== user.id) {
      throw new ForbiddenException('Este examen no es tuyo');
    }
    return this.sessionRepo.findByExam(id);
  }

  @Post()
  async create(@Body() dto: CreateCustomExamDto, @CurrentUser() user: any) {
    return this.createUseCase.execute(dto, user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomExamDto,
    @CurrentUser() user: any,
  ) {
    return this.updateUseCase.execute(id, dto, user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const exam = await this.examRepo.findById(id);
    if (!exam) throw new NotFoundException('Examen no encontrado');
    if (exam.examinerId !== user.id) {
      throw new ForbiddenException('Este examen no es tuyo');
    }
    await this.examRepo.delete(id);
    return { message: 'Examen desactivado exitosamente' };
  }

  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignCandidatesDto,
    @CurrentUser() user: any,
  ) {
    return this.assignUseCase.execute(id, dto, user.id);
  }
}
