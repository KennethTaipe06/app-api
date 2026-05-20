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
import type { ICustomQuestionRepository } from '../../domain/repositories';
import { CUSTOM_QUESTION_REPOSITORY } from '../../domain/repositories';
import {
  CreateCustomQuestionDto,
  UpdateCustomQuestionDto,
} from '../../application/dtos';
import {
  CreateCustomQuestionUseCase,
  UpdateCustomQuestionUseCase,
} from '../../application/use-cases/custom-exams';

@Controller('custom-questions')
@Roles(Role.EXAMINER, Role.ADMIN, Role.SUPER_ADMIN)
export class CustomQuestionsController {
  constructor(
    @Inject(CUSTOM_QUESTION_REPOSITORY)
    private readonly repo: ICustomQuestionRepository,
    private readonly createUseCase: CreateCustomQuestionUseCase,
    private readonly updateUseCase: UpdateCustomQuestionUseCase,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.repo.findByExaminer(user.id, {
      search,
      isActive: includeInactive === 'true' ? undefined : true,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const q = await this.repo.findByIdWithOptions(id);
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    if (q.examinerId !== user.id) {
      throw new ForbiddenException('Esta pregunta no es tuya');
    }
    return q;
  }

  @Post()
  async create(
    @Body() dto: CreateCustomQuestionDto,
    @CurrentUser() user: any,
  ) {
    return this.createUseCase.execute(dto, user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomQuestionDto,
    @CurrentUser() user: any,
  ) {
    return this.updateUseCase.execute(id, dto, user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const q = await this.repo.findById(id);
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    if (q.examinerId !== user.id) {
      throw new ForbiddenException('Esta pregunta no es tuya');
    }
    await this.repo.delete(id);
    return { message: 'Pregunta desactivada exitosamente' };
  }
}
