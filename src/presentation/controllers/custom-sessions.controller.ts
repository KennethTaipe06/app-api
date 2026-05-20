import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../../domain/enums';
import type { ICustomExamSessionRepository } from '../../domain/repositories';
import { CUSTOM_EXAM_SESSION_REPOSITORY } from '../../domain/repositories';
import { SubmitCustomAnswerDto } from '../../application/dtos';
import {
  FinishCustomExamUseCase,
  GetCurrentQuestionUseCase,
  StartCustomExamUseCase,
  SubmitCustomAnswerUseCase,
} from '../../application/use-cases/custom-exams';

@Controller('custom-sessions')
@Roles(Role.CANDIDATE)
export class CustomSessionsController {
  constructor(
    @Inject(CUSTOM_EXAM_SESSION_REPOSITORY)
    private readonly sessionRepo: ICustomExamSessionRepository,
    private readonly startUseCase: StartCustomExamUseCase,
    private readonly getCurrentUseCase: GetCurrentQuestionUseCase,
    private readonly submitUseCase: SubmitCustomAnswerUseCase,
    private readonly finishUseCase: FinishCustomExamUseCase,
  ) {}

  /** Lista las sesiones del candidato actual (PENDING/IN_PROGRESS/etc.) */
  @Get('my')
  async my(@CurrentUser() user: any) {
    return this.sessionRepo.findByCandidate(user.id);
  }

  @Post(':id/start')
  async start(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.startUseCase.execute(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  /** Devuelve UNICAMENTE la pregunta actual, sin marcar correctas */
  @Get(':id/current')
  async current(@Param('id') id: string, @CurrentUser() user: any) {
    return this.getCurrentUseCase.execute(id, user.id);
  }

  /** Califica server-side, avanza el indice, NO devuelve si acerto */
  @Post(':id/answer')
  async answer(
    @Param('id') id: string,
    @Body() dto: SubmitCustomAnswerDto,
    @CurrentUser() user: any,
  ) {
    return this.submitUseCase.execute(id, user.id, dto);
  }

  @Post(':id/finish')
  async finish(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.finishUseCase.execute(id, user.id);
    // No exponemos rawScore/percentage al candidato hasta que el examiner decida
    return {
      sessionId: result.id,
      status: result.status,
      finishedAt: result.finishedAt,
    };
  }
}
