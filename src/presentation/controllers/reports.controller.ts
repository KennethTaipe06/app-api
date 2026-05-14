import {
  Controller,
  Get,
  Param,
  Res,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../../domain/enums';
import type { IResultRepository } from '../../domain/repositories';
import { RESULT_REPOSITORY } from '../../domain/repositories';
import { ExcelService } from '../../infrastructure/services/excel.service';
import type { ReportData } from '../../infrastructure/services/excel.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: IResultRepository,
    private readonly excelService: ExcelService,
    private readonly prisma: PrismaService,
  ) {}

  private mapResultToReportData(result: any): ReportData {
    const scales = (result.scaleResults || []).map((sr: any) => ({
      name: sr.scale?.name || 'N/A',
      code: sr.scale?.code || 'N/A',
      rawScore: sr.rawScore || 0,
      stenScore: sr.stenScore || 0,
      percentile: sr.percentile || 0,
      category: sr.category || 'N/A',
    }));

    // Overall percentile = average of scale percentiles
    const avgPercentile =
      scales.length > 0
        ? Math.round(
            scales.reduce((sum: number, s: any) => sum + s.percentile, 0) /
              scales.length,
          )
        : 0;

    // Overall category based on percentile
    const category =
      avgPercentile >= 70 ? 'Alto' : avgPercentile >= 40 ? 'Medio' : 'Bajo';

    return {
      candidateName: `${result.session?.candidate?.firstName || ''} ${result.session?.candidate?.lastName || ''}`,
      candidateCedula: result.session?.candidate?.cedula || 'N/A',
      testName: result.session?.test?.name || 'N/A',
      testType: result.session?.test?.type || 'N/A',
      completedAt: result.session?.finishedAt
        ? new Date(result.session.finishedAt).toLocaleDateString('es-EC')
        : 'N/A',
      totalScore: result.totalScore || 0,
      percentile: avgPercentile,
      category,
      timeSpentMin: result.session?.timeSpentSec
        ? Math.round(result.session.timeSpentSec / 60)
        : 0,
      scales,
    };
  }

  @Get('session/:sessionId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async downloadSessionReport(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    const result = await this.prisma.result.findFirst({
      where: { sessionId },
      include: {
        scaleResults: { include: { scale: true } },
        session: {
          include: {
            candidate: true,
            test: true,
          },
        },
      },
    });

    if (!result) throw new NotFoundException('Resultado no encontrado');

    const data = this.mapResultToReportData(result);
    const buffer = await this.excelService.generateIndividualReport(data);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=resultado_${data.candidateCedula}_${data.testType}.xlsx`,
    );
    res.send(buffer);
  }

  @Get('test/:testId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EXAMINER, Role.AUDITOR)
  async downloadTestReport(
    @Param('testId') testId: string,
    @Res() res: Response,
  ) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test no encontrado');

    const results = await this.prisma.result.findMany({
      where: { session: { testId } },
      include: {
        scaleResults: { include: { scale: true } },
        session: {
          include: {
            candidate: true,
            test: true,
          },
        },
      },
    });

    const reportData: ReportData[] = results.map((r) =>
      this.mapResultToReportData(r),
    );
    const buffer = await this.excelService.generateGroupReport(
      test.name,
      reportData,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=reporte_grupal_${test.type}.xlsx`,
    );
    res.send(buffer);
  }
}
