import { Injectable } from '@nestjs/common';

interface ScaleScore {
  code: string;
  name: string;
  rawScore: number;
  maxScore: number;
  stenScore: number | null;
  category: string | null;
}

export interface Recommendation {
  aptitud: 'RECOMENDADO' | 'CON_RESERVAS' | 'NO_RECOMENDADO';
  resumen: string;
  fortalezas: string[];
  riesgos: string[];
  observaciones: string[];
}

@Injectable()
export class RecommendationService {
  generate(
    testType: string,
    scales: ScaleScore[],
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): Recommendation {
    switch (testType) {
      case 'KOSTICK':
        return this.analyzeKostick(scales, timeSpentSec, timeLimitMin);
      case 'DISC':
        return this.analyzeDisc(scales, timeSpentSec, timeLimitMin);
      case 'VALANTI':
        return this.analyzeValanti(scales, timeSpentSec, timeLimitMin);
      case 'PF16':
        return this.analyze16PF(scales, timeSpentSec, timeLimitMin);
      default:
        return this.genericAnalysis(scales, timeSpentSec, timeLimitMin);
    }
  }

  private getScale(scales: ScaleScore[], code: string): ScaleScore | undefined {
    return scales.find((s) => s.code === code);
  }

  private pct(score: number, max: number): number {
    return max > 0 ? (score / max) * 100 : 0;
  }

  private timeNote(
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): string | null {
    if (!timeSpentSec || !timeLimitMin) return null;
    const pctUsed = (timeSpentSec / (timeLimitMin * 60)) * 100;
    if (pctUsed < 30)
      return `Completo el examen muy rapido (${Math.round(timeSpentSec / 60)} min de ${timeLimitMin} min). Podria indicar respuestas impulsivas o falta de reflexion.`;
    if (pctUsed > 95)
      return `Uso casi todo el tiempo disponible (${Math.round(timeSpentSec / 60)} min de ${timeLimitMin} min). Podria indicar dificultad o indecision.`;
    return null;
  }

  // ============ KOSTICK ============
  private analyzeKostick(
    scales: ScaleScore[],
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): Recommendation {
    const fortalezas: string[] = [];
    const riesgos: string[] = [];
    const observaciones: string[] = [];

    // Kostick mide 20 dimensiones agrupadas en 7 areas:
    // Liderazgo: N(necesidad), L(rol lider), A(actividad), P(energia)
    const n = this.getScale(scales, 'N');
    const l = this.getScale(scales, 'L');
    const p = this.getScale(scales, 'P');
    const a = this.getScale(scales, 'A');

    // Control/Autoridad
    const d = this.getScale(scales, 'D');
    const w = this.getScale(scales, 'W');
    const c = this.getScale(scales, 'C');

    // Social
    const x = this.getScale(scales, 'X');
    const s = this.getScale(scales, 'S');
    const b = this.getScale(scales, 'B');

    // Adaptacion
    const e = this.getScale(scales, 'E');
    const f = this.getScale(scales, 'F');
    const k = this.getScale(scales, 'K');

    // Agresividad
    const g = this.getScale(scales, 'G');
    const r = this.getScale(scales, 'R');

    if (n && n.category === 'Alto')
      fortalezas.push(
        'Alta necesidad de logro - orientado a resultados y metas.',
      );
    if (l && l.category === 'Alto')
      fortalezas.push(
        'Tendencia al liderazgo - busca dirigir y tomar responsabilidades.',
      );
    if (d && d.category === 'Alto')
      fortalezas.push('Capacidad de tomar decisiones y ejercer autoridad.');
    if (x && x.category === 'Alto')
      fortalezas.push(
        'Habilidades sociales desarrolladas - facilidad para relaciones interpersonales.',
      );
    if (s && s.category === 'Alto')
      fortalezas.push('Sociabilidad alta - trabaja bien en equipo.');
    if (e && e.category === 'Alto')
      fortalezas.push('Estabilidad emocional - manejo adecuado del estres.');
    if (c && c.category === 'Alto')
      fortalezas.push(
        'Disciplina y autocontrol - sigue normas y procedimientos.',
      );
    if (p && p.category === 'Alto')
      fortalezas.push('Alto nivel de energia y ritmo de trabajo.');
    if (a && a.category === 'Alto')
      fortalezas.push(
        'Proactividad - toma la iniciativa y busca nuevos desafios.',
      );

    if (e && e.category === 'Bajo')
      riesgos.push(
        'Baja estabilidad emocional - podria tener dificultad con situaciones de presion.',
      );
    if (c && c.category === 'Bajo')
      riesgos.push(
        'Bajo autocontrol - posible dificultad para seguir normas estrictas.',
      );
    if (f && f.category === 'Bajo')
      riesgos.push('Baja tolerancia a la frustracion.');
    if (g && g.category === 'Alto')
      riesgos.push(
        'Alta agresividad - podria generar conflictos interpersonales.',
      );
    if (r && r.category === 'Alto')
      riesgos.push('Impulsividad elevada - decisiones precipitadas.');
    if (d && d.category === 'Bajo' && l && l.category === 'Bajo')
      riesgos.push(
        'Perfil pasivo - podria no tomar iniciativa cuando se requiere.',
      );
    if (w && w.category === 'Bajo')
      riesgos.push('Evita la responsabilidad y prefiere que otros decidan.');

    // Para policia: se necesita liderazgo + estabilidad + control + sociabilidad
    const criticalHigh = [n, l, e, c, s].filter(
      (s) => s && s.category === 'Alto',
    ).length;
    const criticalLow = [e, c, f].filter(
      (s) => s && s.category === 'Bajo',
    ).length;

    const timeObs = this.timeNote(timeSpentSec, timeLimitMin);
    if (timeObs) observaciones.push(timeObs);

    let aptitud: Recommendation['aptitud'];
    let resumen: string;

    if (criticalHigh >= 4 && criticalLow === 0) {
      aptitud = 'RECOMENDADO';
      resumen =
        'Perfil con fortalezas solidas en areas clave para desempeno policial: liderazgo, estabilidad emocional y trabajo en equipo.';
    } else if (criticalLow >= 2) {
      aptitud = 'NO_RECOMENDADO';
      resumen =
        'Se identifican riesgos significativos en estabilidad emocional y/o autocontrol que podrian afectar el desempeno en situaciones de alta presion.';
    } else {
      aptitud = 'CON_RESERVAS';
      resumen =
        'Perfil mixto con algunas fortalezas pero areas que requieren atencion. Se recomienda evaluacion complementaria.';
    }

    return { aptitud, resumen, fortalezas, riesgos, observaciones };
  }

  // ============ DISC ============
  private analyzeDisc(
    scales: ScaleScore[],
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): Recommendation {
    const fortalezas: string[] = [];
    const riesgos: string[] = [];
    const observaciones: string[] = [];

    const dScale = this.getScale(scales, 'D');
    const iScale = this.getScale(scales, 'I');
    const sScale = this.getScale(scales, 'S');
    const cScale = this.getScale(scales, 'C');

    // Usar segmentos (stenScore) para analisis mas preciso
    const dSeg = dScale?.stenScore ?? 4;
    const iSeg = iScale?.stenScore ?? 4;
    const sSeg = sScale?.stenScore ?? 4;
    const cSeg = cScale?.stenScore ?? 4;

    // Determinar perfil dominante por segmento
    const segments = { D: dSeg, I: iSeg, S: sSeg, C: cSeg };
    const dominant = Object.entries(segments).sort(
      ([, a], [, b]) => b - a,
    )[0][0];

    const profiles: Record<string, string> = {
      D: 'Dominante - decisivo, directo, orientado a resultados',
      I: 'Influyente - comunicativo, entusiasta, persuasivo',
      S: 'Estable - cooperativo, paciente, confiable',
      C: 'Concienzudo - analitico, preciso, orientado a la calidad',
    };

    observaciones.push(`Perfil DISC predominante: ${profiles[dominant]}.`);
    observaciones.push(
      `Segmentos: D=${dSeg}, I=${iSeg}, S=${sSeg}, C=${cSeg} (escala 1-7, 4=promedio).`,
    );

    // Fortalezas para policia
    if (dSeg >= 5)
      fortalezas.push('Capacidad de decision y accion bajo presion.');
    if (sSeg >= 5)
      fortalezas.push('Estabilidad y consistencia en el desempeno.');
    if (cSeg >= 5)
      fortalezas.push('Atencion al detalle y cumplimiento de procedimientos.');
    if (iSeg >= 5)
      fortalezas.push(
        'Habilidad comunicativa y manejo de relaciones publicas.',
      );

    // Riesgos
    if (dSeg >= 6 && sSeg <= 2)
      riesgos.push(
        'Exceso de dominancia con poca paciencia - riesgo de autoritarismo.',
      );
    if (iSeg >= 6 && cSeg <= 2)
      riesgos.push('Puede priorizar relaciones sobre cumplimiento normativo.');
    if (sSeg >= 6 && dSeg <= 2)
      riesgos.push(
        'Resistencia al cambio y dificultad ante emergencias que requieren accion rapida.',
      );
    if (dSeg <= 2 && iSeg <= 2)
      riesgos.push(
        'Perfil muy pasivo - podria no actuar con la firmeza necesaria.',
      );

    const timeObs = this.timeNote(timeSpentSec, timeLimitMin);
    if (timeObs) observaciones.push(timeObs);

    // Para policia: necesita D+S equilibrado, C no bajo
    const goodBalance = dSeg >= 4 && sSeg >= 4 && cSeg >= 3;
    const hasRisks = riesgos.length >= 2;

    let aptitud: Recommendation['aptitud'];
    let resumen: string;

    if (goodBalance && !hasRisks) {
      aptitud = 'RECOMENDADO';
      resumen = `Perfil ${dominant} con equilibrio adecuado entre decision, estabilidad y cumplimiento normativo.`;
    } else if (hasRisks) {
      aptitud = 'NO_RECOMENDADO';
      resumen =
        'Desequilibrio significativo en el perfil conductual que podria afectar el desempeno policial.';
    } else {
      aptitud = 'CON_RESERVAS';
      resumen =
        'Perfil aceptable con areas de mejora. Se sugiere entrevista complementaria para evaluar competencias especificas.';
    }

    return { aptitud, resumen, fortalezas, riesgos, observaciones };
  }

  // ============ VALANTI ============
  private analyzeValanti(
    scales: ScaleScore[],
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): Recommendation {
    const fortalezas: string[] = [];
    const riesgos: string[] = [];
    const observaciones: string[] = [];

    // Valanti mide 6 dimensiones de valores
    const valueLabels: Record<string, string> = {
      T: 'Teorico - busqueda de verdad y conocimiento',
      E: 'Economico - orientacion practica y utilidad',
      ES: 'Estetico - sensibilidad y apreciacion artistica',
      S: 'Social - altruismo y servicio a otros',
      P: 'Politico - poder e influencia',
      R: 'Regulatorio - orden, normas y estructura',
    };

    const highValues: string[] = [];
    const lowValues: string[] = [];

    for (const scale of scales) {
      if (scale.category === 'Alto') {
        highValues.push(scale.code);
        const label = valueLabels[scale.code] || scale.name;
        observaciones.push(`Valor alto en: ${label}.`);
      }
      if (scale.category === 'Bajo') {
        lowValues.push(scale.code);
      }
    }

    // Para policia: valores ideales son S(social), R(regulatorio), P(politico moderado)
    if (highValues.includes('S'))
      fortalezas.push(
        'Alto sentido de servicio social - motivado por ayudar a la comunidad.',
      );
    if (highValues.includes('R'))
      fortalezas.push(
        'Fuerte orientacion a normas y regulaciones - respeta la ley y la estructura.',
      );
    if (highValues.includes('P') && !highValues.includes('E'))
      fortalezas.push(
        'Capacidad de liderazgo basada en influencia y responsabilidad.',
      );
    if (highValues.includes('T'))
      fortalezas.push(
        'Busqueda de conocimiento - abierto a capacitacion y aprendizaje.',
      );

    if (lowValues.includes('S'))
      riesgos.push(
        'Bajo sentido de servicio social - motivacion cuestionable para servicio publico.',
      );
    if (lowValues.includes('R'))
      riesgos.push(
        'Baja orientacion normativa - posible dificultad para acatar procedimientos.',
      );
    if (highValues.includes('E') && lowValues.includes('S'))
      riesgos.push(
        'Orientacion economica por encima del servicio - riesgo etico potencial.',
      );
    if (highValues.includes('P') && lowValues.includes('R'))
      riesgos.push(
        'Busqueda de poder sin respeto por la normativa - perfil de riesgo.',
      );

    const timeObs = this.timeNote(timeSpentSec, timeLimitMin);
    if (timeObs) observaciones.push(timeObs);

    const idealValues = ['S', 'R'].filter((v) => highValues.includes(v)).length;
    const redFlags = riesgos.length;

    let aptitud: Recommendation['aptitud'];
    let resumen: string;

    if (idealValues >= 2 && redFlags === 0) {
      aptitud = 'RECOMENDADO';
      resumen =
        'Valores alineados con el servicio policial: orientacion social y respeto normativo.';
    } else if (redFlags >= 2) {
      aptitud = 'NO_RECOMENDADO';
      resumen =
        'Sistema de valores no compatible con las exigencias eticas del servicio policial.';
    } else {
      aptitud = 'CON_RESERVAS';
      resumen =
        'Valores parcialmente alineados. Se recomienda evaluacion complementaria de motivacion y etica.';
    }

    return { aptitud, resumen, fortalezas, riesgos, observaciones };
  }

  // ============ 16PF ============
  private analyze16PF(
    scales: ScaleScore[],
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): Recommendation {
    const fortalezas: string[] = [];
    const riesgos: string[] = [];
    const observaciones: string[] = [];

    // 16PF factores con STEN score (1-10)
    // A=Afabilidad, B=Razonamiento, C=Estabilidad, E=Dominancia,
    // F=Animacion, G=Atencion normas, H=Atrevimiento, I=Sensibilidad,
    // L=Vigilancia, M=Abstraccion, N=Privacidad, O=Aprension,
    // Q1=Apertura cambio, Q2=Autosuficiencia, Q3=Perfeccionismo, Q4=Tension

    const factorAnalysis: Record<
      string,
      { high: string; low: string; ideal: 'high' | 'mid' | 'low' }
    > = {
      A: {
        high: 'Afable y sociable - buena relacion con la comunidad',
        low: 'Reservado y distante - posible dificultad en trato ciudadano',
        ideal: 'mid',
      },
      C: {
        high: 'Emocionalmente estable - manejo adecuado de presion',
        low: 'Inestabilidad emocional - riesgo en situaciones criticas',
        ideal: 'high',
      },
      E: {
        high: 'Dominante y asertivo - capacidad de mando',
        low: 'Sumiso - dificultad para ejercer autoridad',
        ideal: 'mid',
      },
      G: {
        high: 'Alto apego a normas - cumplimiento institucional',
        low: 'Desapego normativo - riesgo de incumplimiento',
        ideal: 'high',
      },
      H: {
        high: 'Atrevido y seguro - actua con determinacion',
        low: 'Timido y cohibido - podria no actuar en emergencias',
        ideal: 'high',
      },
      L: {
        high: 'Vigilante y suspicaz - alerta ante amenazas, pero puede desconfiar excesivamente',
        low: 'Confiado - podria ser ingenuo ante manipulacion',
        ideal: 'mid',
      },
      O: {
        high: 'Alta aprension y ansiedad - inseguridad que afecta decisiones',
        low: 'Seguro y confiado - no se deja intimidar',
        ideal: 'low',
      },
      Q3: {
        high: 'Alto autocontrol y disciplina',
        low: 'Bajo autocontrol - impulsividad',
        ideal: 'high',
      },
      Q4: {
        high: 'Alta tension - riesgo de burnout y reacciones desproporcionadas',
        low: 'Relajado y tranquilo - buen manejo del estres',
        ideal: 'low',
      },
    };

    for (const scale of scales) {
      const sten = scale.stenScore ?? 5;
      const analysis = factorAnalysis[scale.code];
      if (!analysis) continue;

      if (sten >= 7) {
        if (
          analysis.ideal === 'high' ||
          (analysis.ideal === 'mid' && sten <= 8)
        ) {
          fortalezas.push(analysis.high + '.');
        } else {
          riesgos.push(analysis.high + '.');
        }
      } else if (sten <= 3) {
        if (analysis.ideal === 'low') {
          fortalezas.push(analysis.low + '.');
        } else {
          riesgos.push(analysis.low + '.');
        }
      }
    }

    // Factores criticos para policia: C(estabilidad), G(normas), H(atrevimiento), Q3(autocontrol)
    const cSten = scales.find((s) => s.code === 'C')?.stenScore ?? 5;
    const gSten = scales.find((s) => s.code === 'G')?.stenScore ?? 5;
    const hSten = scales.find((s) => s.code === 'H')?.stenScore ?? 5;
    const q3Sten = scales.find((s) => s.code === 'Q3')?.stenScore ?? 5;
    const q4Sten = scales.find((s) => s.code === 'Q4')?.stenScore ?? 5;

    const criticalGood = [
      cSten >= 6,
      gSten >= 6,
      hSten >= 6,
      q3Sten >= 6,
    ].filter(Boolean).length;
    const criticalBad = [
      cSten <= 3,
      gSten <= 3,
      hSten <= 3,
      q4Sten >= 8,
    ].filter(Boolean).length;

    const timeObs = this.timeNote(timeSpentSec, timeLimitMin);
    if (timeObs) observaciones.push(timeObs);

    // Promedio STEN general
    const avgSten =
      scales.reduce((sum, s) => sum + (s.stenScore ?? 5), 0) / scales.length;
    observaciones.push(
      `Promedio STEN general: ${avgSten.toFixed(1)} (rango normal: 4-7).`,
    );

    let aptitud: Recommendation['aptitud'];
    let resumen: string;

    if (criticalGood >= 3 && criticalBad === 0) {
      aptitud = 'RECOMENDADO';
      resumen =
        'Perfil de personalidad compatible con funciones policiales: estabilidad, apego normativo y autocontrol adecuados.';
    } else if (criticalBad >= 2) {
      aptitud = 'NO_RECOMENDADO';
      resumen =
        'Factores criticos de personalidad por debajo del umbral requerido. Riesgos significativos para funciones de seguridad.';
    } else {
      aptitud = 'CON_RESERVAS';
      resumen =
        'Perfil de personalidad aceptable con algunas areas a reforzar. Se sugiere seguimiento psicologico.';
    }

    return { aptitud, resumen, fortalezas, riesgos, observaciones };
  }

  // ============ GENERICO ============
  private genericAnalysis(
    scales: ScaleScore[],
    timeSpentSec: number | null,
    timeLimitMin: number | null,
  ): Recommendation {
    const fortalezas: string[] = [];
    const riesgos: string[] = [];
    const observaciones: string[] = [];

    for (const scale of scales) {
      if (scale.category === 'Alto')
        fortalezas.push(`${scale.name}: nivel alto.`);
      if (scale.category === 'Bajo') riesgos.push(`${scale.name}: nivel bajo.`);
    }

    const timeObs = this.timeNote(timeSpentSec, timeLimitMin);
    if (timeObs) observaciones.push(timeObs);

    const highCount = scales.filter((s) => s.category === 'Alto').length;
    const lowCount = scales.filter((s) => s.category === 'Bajo').length;

    let aptitud: Recommendation['aptitud'] = 'CON_RESERVAS';
    if (highCount > lowCount * 2) aptitud = 'RECOMENDADO';
    if (lowCount > highCount) aptitud = 'NO_RECOMENDADO';

    return {
      aptitud,
      resumen: 'Analisis general basado en puntajes por escala.',
      fortalezas,
      riesgos,
      observaciones,
    };
  }
}
