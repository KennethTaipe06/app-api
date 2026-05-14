import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

import { Role } from '../../domain/enums';
import type { ITestRepository } from '../../domain/repositories';
import { TEST_REPOSITORY } from '../../domain/repositories';
import { TestType } from '../../domain/enums';
import { CreateTestDto, UpdateTestDto } from '../../application/dtos';
import {
  CreateTestUseCase,
  UpdateTestUseCase,
} from '../../application/use-cases/tests';

@Controller('tests')
export class TestsController {
  constructor(
    @Inject(TEST_REPOSITORY)
    private readonly testRepository: ITestRepository,
    private readonly createTestUseCase: CreateTestUseCase,
    private readonly updateTestUseCase: UpdateTestUseCase,
  ) {}

  @Get()
  async findAll(
    @Query('type') type?: TestType,
    @Query('includeInactive') includeInactive?: string,
    @CurrentUser() user?: any,
  ) {
    const isAdmin =
      user && ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
    const isActiveFilter =
      isAdmin && includeInactive === 'true' ? undefined : true;
    return this.testRepository.findAll({ type, isActive: isActiveFilter });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const test = await this.testRepository.findByIdWithScales(id);
    if (!test) throw new NotFoundException('Test no encontrado');
    return test;
  }

  @Get(':id/questions')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.CANDIDATE)
  async getQuestions(@Param('id') id: string) {
    const test = await this.testRepository.findByIdWithQuestions(id);
    if (!test) throw new NotFoundException('Test no encontrado');
    return test;
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async create(@Body() dto: CreateTestDto, @CurrentUser() user: any) {
    return this.createTestUseCase.execute(dto, user.id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateTestDto) {
    return this.updateTestUseCase.execute(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    const test = await this.testRepository.findById(id);
    if (!test) throw new NotFoundException('Test no encontrado');
    // Soft delete - desactivar en vez de borrar
    await this.testRepository.update(id, { isActive: false } as any);
    return { message: 'Test desactivado exitosamente' };
  }
}
