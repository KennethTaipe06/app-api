import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  IAnswerRepository,
  IResultRepository,
  ITestRepository,
  ISessionRepository,
} from '../../../domain/repositories';
import {
  ANSWER_REPOSITORY,
  RESULT_REPOSITORY,
  TEST_REPOSITORY,
  SESSION_REPOSITORY,
} from '../../../domain/repositories';
import { ResultEntity, ScaleResultEntity } from '../../../domain/entities';
import { TestType } from '../../../domain/enums';

@Injectable()
export class CalculateResultUseCase {
  constructor(
    @Inject(ANSWER_REPOSITORY)
    private readonly answerRepository: IAnswerRepository,
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: IResultRepository,
    @Inject(TEST_REPOSITORY)
    private readonly testRepository: ITestRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(sessionId: string): Promise<ResultEntity> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Sesion no encontrada');
    }

    const test = await this.testRepository.findByIdWithScales(session.testId);
    if (!test) {
      throw new NotFoundException('Test no encontrado');
    }

    const answers = await this.answerRepository.findBySession(sessionId);
    const testWithQuestions = await this.testRepository.findByIdWithQuestions(
      session.testId,
    );
    const questions = (testWithQuestions as any)?.questions || [];
    const testType = test.type;

    // Calcular puntajes segun el tipo de test
    let scaleScores: Record<string, number>;

    switch (testType) {
      case TestType.KOSTICK:
        scaleScores = this.calculateKostick(answers, questions);
        break;
      case TestType.VALANTI:
        scaleScores = this.calculateValanti(answers, questions);
        break;
      case TestType.DISC:
        scaleScores = this.calculateDisc(answers, questions);
        break;
      case TestType.PF16:
        scaleScores = this.calculate16PF(answers, questions);
        break;
      default:
        scaleScores = {};
    }

    // Calcular maxScores reales a partir de las preguntas
    const realMaxScores = this.computeRealMaxScores(testType, questions);

    // Crear ScaleResults con baremos correctos por tipo de test
    const scales = (test as any).scales || [];
    const scaleResults: Partial<ScaleResultEntity>[] = scales.map(
      (scale: any) => {
        const rawScore = scaleScores[scale.code] ?? 0;
        const maxScore = realMaxScores[scale.code] ?? scale.maxScore;

        return {
          scaleId: scale.id,
          rawScore,
          percentile: this.calculatePercentile(rawScore, maxScore, testType),
          stenScore:
            testType === TestType.PF16
              ? this.rawToSten16PF(rawScore, maxScore)
              : testType === TestType.DISC
                ? this.discDiffToSegment(rawScore)
                : null,
          category: this.categorize(rawScore, maxScore, testType),
        };
      },
    );

    const totalScore = Object.values(scaleScores).reduce(
      (sum, v) => sum + v,
      0,
    );

    return this.resultRepository.create(
      {
        sessionId,
        totalScore,
        rawData: scaleScores,
        interpretation: null,
      },
      scaleResults,
    );
  }

  // ============================================================
  // CALCULO DE PUNTAJES BRUTOS
  // ============================================================

  // Kostick: cada respuesta A o B suma 1 punto a la escala mapeada
  private calculateKostick(
    answers: any[],
    questions: any[],
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const answer of answers) {
      const question = questions.find((q: any) => q.id === answer.questionId);
      if (!question?.scoring) continue;

      const choice = answer.response?.value || answer.response;
      const scaleCode = question.scoring[choice];
      if (scaleCode) {
        scores[scaleCode] = (scores[scaleCode] || 0) + 1;
      }
    }
    return scores;
  }

  // Valanti: distributivo. Cada respuesta trae {pointsA, pointsB} con
  // asignaciones validas (3-0, 0-3, 2-1, 1-2). Los puntos se suman a la
  // dimension mapeada por question.scoring.A / .B, sumando tanto la parte
  // de valores como la de antivalores (en antivalores, altos puntos = mayor
  // rechazo, que refuerza la valoracion de la virtud de la misma dimension).
  // Retrocompatible con el formato forced-choice viejo (A=1 / B=1).
  private calculateValanti(
    answers: any[],
    questions: any[],
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const answer of answers) {
      const question = questions.find((q: any) => q.id === answer.questionId);
      if (!question?.scoring) continue;

      const dimA = question.scoring.A;
      const dimB = question.scoring.B;
      const resp = answer.response || {};

      // Formato distributivo nuevo
      if (
        typeof resp.pointsA === 'number' &&
        typeof resp.pointsB === 'number'
      ) {
        if (dimA) scores[dimA] = (scores[dimA] || 0) + resp.pointsA;
        if (dimB) scores[dimB] = (scores[dimB] || 0) + resp.pointsB;
        continue;
      }

      // Fallback: formato forced-choice antiguo
      const choice = resp.value || resp;
      const dim = choice === 'A' ? dimA : choice === 'B' ? dimB : null;
      if (dim) scores[dim] = (scores[dim] || 0) + 1;
    }
    return scores;
  }

  // DISC: respuesta tiene {most: "idx", least: "idx"}
  // Puntaje = most_count - least_count por escala
  private calculateDisc(
    answers: any[],
    questions: any[],
  ): Record<string, number> {
    const most: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
    const least: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };

    for (const answer of answers) {
      const question = questions.find((q: any) => q.id === answer.questionId);
      if (!question?.scoring) continue;

      const response = answer.response;
      const mostScale = question.scoring?.most?.[response.most];
      const leastScale = question.scoring?.least?.[response.least];

      if (mostScale && most[mostScale] !== undefined) {
        most[mostScale]++;
      }
      if (leastScale && least[leastScale] !== undefined) {
        least[leastScale]++;
      }
    }

    return {
      D: most.D - least.D,
      I: most.I - least.I,
      S: most.S - least.S,
      C: most.C - least.C,
    };
  }

  // 16PF: cada respuesta A=2, B=1, C=0 (o invertido segun la pregunta)
  private calculate16PF(
    answers: any[],
    questions: any[],
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const answer of answers) {
      const question = questions.find((q: any) => q.id === answer.questionId);
      if (!question?.scoring) continue;

      const choice = answer.response?.value || answer.response;
      const mapping = question.scoring[choice];
      if (mapping) {
        const factor = mapping.factor;
        const score = mapping.score;
        scores[factor] = (scores[factor] || 0) + score;
      }
    }
    return scores;
  }

  // ============================================================
  // CALCULO DE MAX SCORES REALES (derivado de las preguntas)
  // ============================================================
  private computeRealMaxScores(
    testType: TestType,
    questions: any[],
  ): Record<string, number> {
    const maxScores: Record<string, number> = {};

    if (testType === TestType.KOSTICK) {
      // Ipsative forced-choice: cada pregunta aporta 1 punto a una escala
      for (const q of questions) {
        if (!q.scoring) continue;
        const codes = new Set<string>();
        for (const key of ['A', 'B']) {
          if (q.scoring[key]) codes.add(q.scoring[key]);
        }
        for (const code of codes) {
          maxScores[code] = (maxScores[code] || 0) + 1;
        }
      }
    } else if (testType === TestType.VALANTI) {
      // Distributivo: cada pregunta puede aportar hasta 3 puntos a UNA dimension
      // si el candidato asigna 3-0. Max por dimension = 3 × numero de preguntas
      // en las que aparece como opcion (A o B).
      for (const q of questions) {
        if (!q.scoring) continue;
        const codes = new Set<string>();
        for (const key of ['A', 'B']) {
          if (q.scoring[key]) codes.add(q.scoring[key]);
        }
        for (const code of codes) {
          maxScores[code] = (maxScores[code] || 0) + 3;
        }
      }
    } else if (testType === TestType.DISC) {
      // DISC: rango teorico de diferencia es [-totalQ, +totalQ]
      // Usamos totalQuestions como referencia para el segmento
      const totalQ = questions.length;
      for (const code of ['D', 'I', 'S', 'C']) {
        maxScores[code] = totalQ;
      }
    } else if (testType === TestType.PF16) {
      // 16PF: max = numPreguntas * maxPuntajePorPregunta (2)
      for (const q of questions) {
        if (!q.scoring) continue;
        // Find the factor and max score from any option
        let factor: string | null = null;
        let maxPts = 0;
        for (const key of ['A', 'B', 'C']) {
          const m = q.scoring[key];
          if (m?.factor) {
            factor = m.factor;
            if (m.score > maxPts) maxPts = m.score;
          }
        }
        if (factor) {
          maxScores[factor] = (maxScores[factor] || 0) + maxPts;
        }
      }
    }

    return maxScores;
  }

  // ============================================================
  // BAREMOS NORMATIVOS (stub)
  // ============================================================
  // Los metodos a continuacion (rawToSten16PF, discDiffToSegment,
  // calculatePercentile) usan conversiones teoricas basadas en la distribucion
  // normal estandar, NO baremos poblacionales reales.
  //
  // Para uso clinico/selectivo serio habria que cargar tablas normativas por:
  //   - Test (Kostick, Valanti, DISC, 16PF)
  //   - Edad / rango etario
  //   - Sexo
  //   - Contexto (laboral, clinico, educativo)
  //   - Poblacion de referencia (pais/region)
  //
  // Implementacion sugerida: tabla `NormTable` en BD con {testType, scaleCode,
  // ageRange, sex, rawScore → percentile/sten}, y un metodo
  // `lookupNormative(testType, scaleCode, rawScore, demographic)` que
  // reemplace las conversiones teoricas cuando haya tabla disponible.
  // TODO: implementar tabla NormTable + carga de normas oficiales.

  // ============================================================
  // BAREMOS TEORICOS: STEN (16PF)
  // Tabla normativa basada en distribucion normal estandarizada
  // STEN = Standard TEN score (media=5.5, SD=2, rango 1-10)
  // ============================================================
  private rawToSten16PF(rawScore: number, maxScore: number): number {
    if (maxScore <= 0) return 5;
    const pct = rawScore / maxScore;

    // Tabla de conversion: porcentaje del maximo → STEN
    // Basada en la distribucion normal acumulada (z-scores)
    // STEN 1: z < -2.0 (bottom 2.3%)
    // STEN 2: z -2.0 to -1.5 (2.3-6.7%)
    // STEN 3: z -1.5 to -1.0 (6.7-15.9%)
    // STEN 4: z -1.0 to -0.5 (15.9-30.9%)
    // STEN 5: z -0.5 to 0.0 (30.9-50%)
    // STEN 6: z 0.0 to +0.5 (50-69.1%)
    // STEN 7: z +0.5 to +1.0 (69.1-84.1%)
    // STEN 8: z +1.0 to +1.5 (84.1-93.3%)
    // STEN 9: z +1.5 to +2.0 (93.3-97.7%)
    // STEN 10: z > +2.0 (top 2.3%)
    if (pct <= 0.04) return 1;
    if (pct <= 0.11) return 2;
    if (pct <= 0.23) return 3;
    if (pct <= 0.4) return 4;
    if (pct <= 0.6) return 5;
    if (pct <= 0.77) return 6;
    if (pct <= 0.89) return 7;
    if (pct <= 0.96) return 8;
    if (pct <= 0.99) return 9;
    return 10;
  }

  // ============================================================
  // BAREMOS: DISC Segmentos (1-7)
  // Conversion de diferencia (most-least) a perfil segmentado
  // Basado en tablas normativas DISC de Cleaver/Marston
  // ============================================================
  private discDiffToSegment(diff: number): number {
    // Segmento 7: Muy Alto (>= +10)
    // Segmento 6: Alto (+6 a +9)
    // Segmento 5: Sobre promedio (+3 a +5)
    // Segmento 4: Promedio (-2 a +2)
    // Segmento 3: Bajo promedio (-5 a -3)
    // Segmento 2: Bajo (-9 a -6)
    // Segmento 1: Muy Bajo (<= -10)
    if (diff >= 10) return 7;
    if (diff >= 6) return 6;
    if (diff >= 3) return 5;
    if (diff >= -2) return 4;
    if (diff >= -5) return 3;
    if (diff >= -9) return 2;
    return 1;
  }

  // ============================================================
  // PERCENTIL (aproximado por tipo de test)
  // ============================================================
  private calculatePercentile(
    rawScore: number,
    maxScore: number,
    testType: TestType,
  ): number {
    if (testType === TestType.DISC) {
      // DISC: mapear diferencia [-max, +max] a percentil [1, 99]
      const segment = this.discDiffToSegment(rawScore);
      const segmentToPercentile: Record<number, number> = {
        1: 4,
        2: 12,
        3: 25,
        4: 50,
        5: 75,
        6: 88,
        7: 96,
      };
      return segmentToPercentile[segment] ?? 50;
    }

    if (testType === TestType.PF16) {
      // 16PF: usar STEN para derivar percentil
      const sten = this.rawToSten16PF(rawScore, maxScore);
      const stenToPercentile: Record<number, number> = {
        1: 1,
        2: 4,
        3: 11,
        4: 23,
        5: 40,
        6: 60,
        7: 77,
        8: 89,
        9: 96,
        10: 99,
      };
      return stenToPercentile[sten] ?? 50;
    }

    // KOSTICK / VALANTI: porcentaje directo como percentil
    if (maxScore <= 0) return 50;
    return Math.round((rawScore / maxScore) * 100);
  }

  // ============================================================
  // CATEGORIZACION (por tipo de test)
  // ============================================================
  private categorize(
    score: number,
    maxScore: number,
    testType: TestType,
  ): string {
    if (testType === TestType.DISC) {
      const segment = this.discDiffToSegment(score);
      if (segment >= 6) return 'Alto';
      if (segment >= 3) return 'Medio';
      return 'Bajo';
    }

    if (testType === TestType.PF16) {
      const sten = this.rawToSten16PF(score, maxScore);
      if (sten >= 7) return 'Alto';
      if (sten >= 4) return 'Medio';
      return 'Bajo';
    }

    // KOSTICK / VALANTI: porcentaje con maxScore real
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (percentage >= 70) return 'Alto';
    if (percentage >= 40) return 'Medio';
    return 'Bajo';
  }
}
