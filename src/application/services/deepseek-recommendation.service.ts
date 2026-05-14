import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// ─── Types ──────────────────────────────────────────────────────

export type AiCalificacion =
  | 'NO_APTA'
  | 'APTITUD_BAJA'
  | 'APTITUD_MEDIA'
  | 'APTITUD_ALTA'
  | 'APTA';

export type IapDictamen =
  | 'APTO_EXCELENTE' // 85-100
  | 'APTO_CON_RESERVAS' // 70-84
  | 'NO_APTO_DESARROLLABLE' // 55-69
  | 'NO_APTO_RIESGO' // 0-54
  | 'PRUEBA_INVALIDADA'; // filtros de invalidacion activados

export interface IapBreakdown {
  pf16: number; // 0-25
  disc: number; // 0-15
  valanti: number; // 0-30
  kostick: number; // 0-30
}

export interface AiRecommendationResult {
  calificacion: AiCalificacion;
  resumen: string;
  fortalezas: string[];
  riesgos: string[];
  observaciones: string[];
  // Reporte cuantitativo IAP (Indice de Adecuacion al Puesto)
  iapScore: number; // 0-100
  iapBreakdown: IapBreakdown;
  dictamen: IapDictamen;
  invalidated: boolean;
  invalidationReasons: string[];
}

interface TestBatteryInput {
  testType: string;
  testName: string;
  timeSpentSec: number | null;
  timeLimitMin: number | null;
  alertCount: number;
  scales: {
    code: string;
    name: string;
    rawScore: number;
    maxScore: number;
    stenScore: number | null;
    category: string | null;
  }[];
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class DeepseekRecommendationService {
  private readonly logger = new Logger(DeepseekRecommendationService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'DEEPSEEK_API_KEY no configurada — las recomendaciones IA no estaran disponibles',
      );
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'missing',
      baseURL: 'https://api.deepseek.com',
    });

    this.model = 'deepseek-chat';
  }

  /**
   * Genera una recomendacion integral basada en la bateria completa de 4 tests.
   */
  async generate(
    candidateName: string,
    tests: TestBatteryInput[],
  ): Promise<{
    result: AiRecommendationResult;
    prompt: string;
    rawResponse: string;
  }> {
    const prompt = this.buildPrompt(candidateName, tests);

    this.logger.log(
      `Generando recomendacion IA para "${candidateName}" con ${tests.length} tests...`,
    );

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';

    this.logger.log('Respuesta DeepSeek recibida, parseando...');

    const result = this.parseResponse(rawResponse);

    return { result, prompt, rawResponse };
  }

  // ─── Prompt Builder ─────────────────────────────────────────────

  private getSystemPrompt(): string {
    return `Eres un psicólogo organizacional experto en evaluaciones psicométricas.
Tu trabajo es analizar los resultados de una batería completa de tests psicométricos y emitir un veredicto de aptitud para el cargo de DOCENTE UNIVERSITARIO.

═══════════════════════════════════════════════════════════════
CONTEXTO DE LOS TESTS (batería de 4 instrumentos)
═══════════════════════════════════════════════════════════════

1) KOSTICK (PAPI) — 90 pares de elección forzada ipsativa
   Mide 20 roles y necesidades laborales. Puntaje crudo 0-9 por escala.
   Escalas clave para docente universitario:
     L=Liderazgo, A=Logro, N=Control/autoridad, P=Organización,
     G=Constancia, V=Vigor, I=Decisión, K=Agresividad,
     R=Seguidor/respeto, S=Sociabilidad, E=Estabilidad emocional,
     F=Tolerancia frustración, C=Confrontación.
   Interpretación: 0-3 Bajo, 4-6 Medio, 7-9 Alto.

2) DISC — 28 grupos balanceados (MÁS/MENOS) con permutaciones rotadas
   Mide 4 dimensiones conductuales: D=Dominancia, I=Influencia,
   S=Estabilidad, C=Concienzudo. Segmento 1-7 (4 = promedio).
   Gráficos: Natural (MÁS), Adaptado (MENOS), Conducta (diferencia).

3) VALANTI (Valores y Antivalores) — 80 pares con distribución de 3 puntos
   NUEVO FORMATO DISTRIBUTIVO: el candidato reparte 3 puntos entre dos
   opciones (3-0 / 2-1 / 1-2 / 0-3), no elige una. Por eso el raw score
   refleja preferencia relativa, no mayoritaria.
   Mide 5 dimensiones humanas fundamentales (tradición Sathya Sai):
     V = Verdad        (nivel intelectual — honestidad cognitiva)
     R = Rectitud      (nivel físico — integridad en la acción)
     P = Paz           (nivel emocional — autorregulación)
     A = Amor          (nivel psíquico — empatía y servicio)
     N = No-violencia  (nivel espiritual — respeto por la vida)
   Puntaje crudo 0-96 por dimensión (32 apariciones x 3 pts).
   Secciones: 40 ítems de VALORES (preferencias positivas) y 40 de
   ANTIVALORES (rechazos — lo que MENOS lo define). Un perfil sano
   muestra Valores altos y Antivalores bajos en la misma dimensión.

4) 16PF (Cattell, 5ta edición) — 191 ítems de opción múltiple ABC
   Mide 16 factores primarios + 5 globales. Puntaje STEN 1-10
   (5.5 = promedio, <=3 bajo, >=8 alto). Factores clave:
     C=Estabilidad, G=Acatamiento normativo, H=Osadía social,
     L=Vigilancia, O=Aprensión, Q3=Autocontrol, Q4=Tensión.

═══════════════════════════════════════════════════════════════
COMPETENCIAS DOCENTES A EVALUAR
═══════════════════════════════════════════════════════════════

COMPETENCIAS ACTITUDINALES (rasgos de carácter del docente):
  • Proactividad
  • Creatividad
  • Confiabilidad
  • Flexibilidad
  • Resiliencia
  • Empatía
  • Confianza en sí mismo
  • Comprensión y solidaridad
  → Estas competencias sostienen las relaciones inter e intrapersonales
    y se evalúan transversalmente en los 4 instrumentos.

CAPACIDADES ESPECÍFICAS DEL DOCENTE (competencias técnico-pedagógicas):
  1. Dominio disciplinar y capacidad de traducirlo pedagógicamente
     → Indicadores: Kostick A (Logro) alto, DISC C alto (precisión/rigor)
  2. Diseño pedagógico centrado en el aprendizaje y pensamiento de orden superior
     → Indicadores: Kostick P (Organización) >= 5, DISC C >= 4
  3. Competencia en evaluación formativa y retroalimentación de calidad
     → Indicadores: 16PF G >= 6, Valanti V (Verdad) >= 60
  4. Competencia digital docente y alfabetización en IA con integración ética
     → Indicadores: Kostick I (Decisión) >= 5, Valanti R (Rectitud) >= 65
  5. Competencia ética y juicio profesional
     → Indicadores: Valanti V+R >= 130 combinado, 16PF G >= 6
  6. Competencia socioemocional y relacional
     → Indicadores: Kostick S (Sociabilidad) >= 5, Kostick E >= 6,
       16PF C >= 6, Valanti A (Amor) >= 60
  7. Competencia para la inclusión y la diferenciación
     → Indicadores: Valanti N (No-violencia) >= 55, DISC S >= 3,
       Kostick F (Tolerancia a frustración) >= 5
  8. Competencia para trabajar con el estudiante como agente del aprendizaje
     → Indicadores: DISC I >= 4, Kostick L >= 5, Valanti A >= 60
  9. Competencia investigativa, reflexiva y basada en evidencia
     → Indicadores: 16PF Q3 >= 6, Kostick G (Constancia) >= 5,
       DISC C >= 4
  10. Aprendizaje permanente y adaptabilidad profesional
      → Indicadores: 16PF H >= 5, Kostick V (Vigor) >= 5,
        Valanti P (Paz) >= 55

═══════════════════════════════════════════════════════════════
PERFIL IDEAL — CRITERIOS REFERENCIALES
═══════════════════════════════════════════════════════════════
  Estabilidad emocional alta ........ Kostick E >= 6 AND 16PF C >= 6
  Autocontrol / disciplina .......... Kostick C >= 5 AND 16PF G y Q3 >= 6
  Liderazgo pedagógico equilibrado .. Kostick L y N = 5-8, DISC D = 4-6
  Orientación al servicio/empatía ... Valanti A (Amor) >= 60/96, DISC S 3-5
  Respeto normativo y ético ......... Valanti R (Rectitud) >= 65/96, 16PF G >= 6
  Honestidad cognitiva .............. Valanti V (Verdad) >= 60/96
  Manejo del conflicto / paz ........ Valanti P (Paz) >= 55/96, Valanti N >= 55/96
  Baja agresividad impulsiva ........ Kostick K <= 4, 16PF Q4 <= 5
  Tolerancia a frustración .......... Kostick F >= 5, 16PF O <= 6
  Acción bajo presión y osadía social DISC D >= 4, 16PF H >= 6
  Proactividad y vigor .............. Kostick V >= 5, DISC D >= 4
  Flexibilidad y adaptabilidad ...... 16PF H >= 5, Valanti P >= 55
  Confiabilidad / constancia ........ Kostick G >= 5, 16PF G >= 6
  Creatividad e iniciativa .......... Kostick I >= 5, DISC I >= 4

═══════════════════════════════════════════════════════════════
REPORTE CUANTITATIVO IAP — INDICE DE ADECUACION AL PUESTO (0-100)
═══════════════════════════════════════════════════════════════

Aplica las reglas del MODELO IAP (documento institucional de Gestion del
Talento Humano). DEBES calcular un puntaje cuantitativo, no solo cualitativo.

PONDERACION POR INSTRUMENTO (suma exacta = 100 pts):
  • 16PF    → maximo 25 pts  (personalidad base)
  • DISC    → maximo 15 pts  (personalidad y comunicacion, junto con 16PF)
  • Valanti → maximo 30 pts  (etica y valores corporativos)
  • Kostick → maximo 30 pts  (estilo de trabajo y ejecucion)

Para cada instrumento calcula su ajuste al perfil (0..max). Tu puntaje
debe reflejar cuan bien las escalas obtenidas se alinean con el PERFIL
IDEAL. Suma los 4 ajustes → IAP final (0-100).

═══════════════════════════════════════════════════════════════
CRITERIOS DE INVALIDACION (filtros de descarte, OBLIGATORIO revisar PRIMERO)
═══════════════════════════════════════════════════════════════
Si CUALQUIERA de estos se activa, dictamen = "PRUEBA_INVALIDADA",
invalidated = true, iapScore = 0, y enumera la(s) causa(s) en
invalidation_reasons:

  1. Inconsistencia logica (16PF): C STEN=10 Y Q4 STEN=10 simultaneamente.
  2. Speeding: tiempo total < 40% del limite estandar esperado.
  3. Proctoring: > 15 alertas de perdida de foco / cambio de ventana.

═══════════════════════════════════════════════════════════════
TABLA DE DECISION IAP (mapeo iapScore → dictamen)
═══════════════════════════════════════════════════════════════
  85 – 100 → APTO_EXCELENTE         (avanzar a fase final; brechas minimas)
  70 –  84 → APTO_CON_RESERVAS      (verificar incidentes en entrevista)
  55 –  69 → NO_APTO_DESARROLLABLE  (descartar para rol actual; retomable)
   0 –  54 → NO_APTO_RIESGO         (descarte inmediato por contraindicaciones)

CALIFICACION CUALITATIVA (mapeo IAP → calificacion existente):
  iapScore >= 85           → APTA
  iapScore 70-84           → APTITUD_ALTA
  iapScore 55-69           → APTITUD_MEDIA
  iapScore 25-54           → APTITUD_BAJA
  iapScore 0-24 o invalida → NO_APTA

═══════════════════════════════════════════════════════════════
ESCALA DE CALIFICACIÓN — CUANTITATIVA + CUALITATIVA (referencial)
═══════════════════════════════════════════════════════════════

Tambien evalua el grado de cobertura de las 10 CAPACIDADES ESPECIFICAS
y las 8 COMPETENCIAS ACTITUDINALES.

Reporta cuántas competencias están suficientemente respaldadas por los datos.

Restar penalidades sobre el IAP (no aplicar si ya esta invalidado): -5 por
proctoring >=3 alertas, -5 si tiempo total <30% del limite, -3 si >95%,
hasta -15 max. Estas penalidades se reflejan en iapScore final.

Mapea el índice cualitativo a la banda correspondiente (usa estos valores EXACTOS):

┌─────────────────┬─────────┬────────────────────────────────────────────────┐
│ calificacion    │ indice  │ descripcion cualitativa                        │
├─────────────────┼─────────┼────────────────────────────────────────────────┤
│ NO_APTA         │  0-24   │ Contraindicaciones severas para la función     │
│                 │         │ docente. >=3 factores críticos: baja           │
│                 │         │ estabilidad (C<4) + alta agresividad (K>6 o   │
│                 │         │ Q4>7) + bajo acatamiento (G<4 o R Valanti      │
│                 │         │ <35). Riesgo inviable: ausencia de empatía,    │
│                 │         │ ética o tolerancia impide el rol pedagógico    │
├─────────────────┼─────────┼────────────────────────────────────────────────┤
│ APTITUD_BAJA    │ 25-44   │ Debilidades significativas en 2+ áreas         │
│                 │         │ críticas para la docencia. Ej: autocontrol     │
│                 │         │ limitado + baja tolerancia o déficit ético.    │
│                 │         │ Requiere desarrollo considerable (6+ meses)    │
│                 │         │ antes de asumir funciones frente a estudiantes │
├─────────────────┼─────────┼────────────────────────────────────────────────┤
│ APTITUD_MEDIA   │ 45-64   │ Perfil aceptable con 1-2 áreas de mejora       │
│                 │         │ moderada. Cubre al menos 6/10 capacidades      │
│                 │         │ específicas. Sin contraindicaciones graves.    │
│                 │         │ Podría desempeñarse con supervisión directa    │
│                 │         │ y plan de capacitación pedagógica focalizado   │
├─────────────────┼─────────┼────────────────────────────────────────────────┤
│ APTITUD_ALTA    │ 65-84   │ Buen perfil general. Cubre 7-8/10 capacidades  │
│                 │         │ específicas y 6+/8 competencias actitudinales. │
│                 │         │ Fortalezas sólidas en estabilidad, ética y     │
│                 │         │ relaciones. Sin riesgos significativos.        │
│                 │         │ Apto con observaciones menores de seguimiento  │
├─────────────────┼─────────┼────────────────────────────────────────────────┤
│ APTA            │ 85-100  │ Perfil excelente para la docencia universitaria│
│                 │         │ Cubre 9-10/10 capacidades específicas y 7+/8  │
│                 │         │ competencias actitudinales. Fortalezas         │
│                 │         │ destacadas en estabilidad, autocontrol,        │
│                 │         │ valores y conducta relacional. Sin alertas.    │
│                 │         │ Consistencia entre tests. Candidato            │
│                 │         │ recomendado sin reservas para el aula          │
└─────────────────┴─────────┴────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
REGLAS DE ANÁLISIS
═══════════════════════════════════════════════════════════════
1. Analiza los 4 tests en CONJUNTO. Busca patrones cruzados (ej:
   Kostick E alto + 16PF C bajo = inconsistencia — reportar).
2. En Valanti compara Valores vs Antivalores por dimensión: si una
   dimensión es alta en ambos hay INCONSISTENCIA (candidato sin criterio
   claro o respondiendo al azar).
3. Mapea los resultados psicométricos a las 10 CAPACIDADES ESPECÍFICAS
   y 8 COMPETENCIAS ACTITUDINALES del docente. Indica cuáles están
   respaldadas, cuáles son dudosas y cuáles presentan déficit.
4. Tiempo <30% del límite: sospechoso, posible respuesta apresurada.
   Tiempo >95%: posible dificultad cognitiva o dudas.
5. Alertas de proctoring >=3: impacta confiabilidad de resultados.
6. DISC inválido (todos los segmentos iguales o patrón plano) debe
   marcarse como observación.
7. Incluye SIEMPRE en "observaciones" el índice numérico calculado,
   el desglose por test y la cobertura de competencias docentes
   (ej: "Índice: 72/100 — K:18/25, D:14/20, V:19/25, P:21/30 |
   Capacidades cubiertas: 7/10 | Competencias actitudinales: 6/8").
8. Sé profesional y claro. Los resultados serán leídos por
   examinadores académicos y profesionales de RRHH universitario.

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (SOLO JSON)
═══════════════════════════════════════════════════════════════
{
  "iapScore": 0-100,
  "iapBreakdown": { "pf16": 0-25, "disc": 0-15, "valanti": 0-30, "kostick": 0-30 },
  "dictamen": "APTO_EXCELENTE | APTO_CON_RESERVAS | NO_APTO_DESARROLLABLE | NO_APTO_RIESGO | PRUEBA_INVALIDADA",
  "invalidated": true|false,
  "invalidation_reasons": ["lista de causas si invalidated=true, vacio si no"],
  "calificacion": "NO_APTA | APTITUD_BAJA | APTITUD_MEDIA | APTITUD_ALTA | APTA",
  "resumen": "Párrafo ejecutivo de 2-4 oraciones con la conclusión principal, el índice numérico y la cobertura de competencias docentes",
  "fortalezas": [
    "Fortaleza 1 con evidencia cuantitativa y competencia docente asociada (ej: 'Alta estabilidad socioemocional — soporta Competencia 6: Kostick E=8, 16PF C=STEN 8, Valanti A=68')",
    "..."
  ],
  "riesgos": [
    "Riesgo 1 con evidencia cuantitativa y capacidad docente en déficit (ej: 'Baja tolerancia a la frustración limita Competencia 7 de inclusión: Kostick F=3, 16PF O=7')",
    "..."
  ],
  "competencias_docentes": {
    "cubiertas": ["Lista de capacidades específicas respaldadas por los datos"],
    "en_desarrollo": ["Capacidades con cobertura parcial o indicadores límite"],
    "en_deficit": ["Capacidades sin respaldo psicométrico suficiente"]
  },
  "observaciones": [
    "Índice: X/100 — desglose por test | Capacidades cubiertas: X/10 | Actitudinales: X/8",
    "Observaciones sobre tiempos, consistencia entre tests y proctoring"
  ]
}`;
  }
  private buildPrompt(
    candidateName: string,
    tests: TestBatteryInput[],
  ): string {
    let prompt = `CANDIDATO: ${candidateName}\nBATERIA COMPLETA: ${tests.length} tests\n\n`;

    for (const test of tests) {
      prompt += `═══ ${test.testType} - ${test.testName} ═══\n`;

      // Tiempo
      if (test.timeSpentSec && test.timeLimitMin) {
        const usedMin = Math.round(test.timeSpentSec / 60);
        const pctUsed = Math.round(
          (test.timeSpentSec / (test.timeLimitMin * 60)) * 100,
        );
        prompt += `Tiempo: ${usedMin}/${test.timeLimitMin} min (${pctUsed}% usado)\n`;
      }

      // Alertas
      prompt += `Alertas de proctoring: ${test.alertCount}\n`;

      // Escalas
      prompt += `Resultados por escala:\n`;
      for (const scale of test.scales) {
        let line = `  ${scale.code} (${scale.name}): raw=${scale.rawScore}/${scale.maxScore}`;
        if (scale.stenScore != null) {
          if (test.testType === 'DISC') {
            line += `, segmento=${scale.stenScore}/7`;
          } else if (test.testType === 'PF16') {
            line += `, STEN=${scale.stenScore}/10`;
          }
        }
        if (scale.category) {
          line += `, categoria=${scale.category}`;
        }
        prompt += line + '\n';
      }

      prompt += '\n';
    }

    prompt +=
      'Analiza TODOS los tests en conjunto y emite tu veredicto en formato JSON.';

    return prompt;
  }

  // ─── Response Parser ──────────────────────────────────────────

  private parseResponse(raw: string): AiRecommendationResult {
    try {
      const parsed = JSON.parse(raw);

      // Validar calificacion
      const validCalificaciones: AiCalificacion[] = [
        'NO_APTA',
        'APTITUD_BAJA',
        'APTITUD_MEDIA',
        'APTITUD_ALTA',
        'APTA',
      ];

      const calificacion = validCalificaciones.includes(parsed.calificacion)
        ? (parsed.calificacion as AiCalificacion)
        : 'APTITUD_MEDIA';

      // ── IAP cuantitativo ──
      const validDictamenes: IapDictamen[] = [
        'APTO_EXCELENTE',
        'APTO_CON_RESERVAS',
        'NO_APTO_DESARROLLABLE',
        'NO_APTO_RIESGO',
        'PRUEBA_INVALIDADA',
      ];

      const invalidated = parsed.invalidated === true;
      const invalidationReasons: string[] = Array.isArray(
        parsed.invalidation_reasons,
      )
        ? parsed.invalidation_reasons.filter(
            (r: unknown) => typeof r === 'string',
          )
        : [];

      const clamp = (n: unknown, max: number): number => {
        const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
        return Math.max(0, Math.min(max, Math.round(v)));
      };

      const breakdownIn = parsed.iapBreakdown || {};
      const iapBreakdown: IapBreakdown = {
        pf16: clamp(breakdownIn.pf16, 25),
        disc: clamp(breakdownIn.disc, 15),
        valanti: clamp(breakdownIn.valanti, 30),
        kostick: clamp(breakdownIn.kostick, 30),
      };

      let iapScore = clamp(parsed.iapScore, 100);
      // Si el modelo no devolvio iapScore consistente, derivar de breakdown
      const sumBreakdown =
        iapBreakdown.pf16 +
        iapBreakdown.disc +
        iapBreakdown.valanti +
        iapBreakdown.kostick;
      if (!parsed.iapScore && sumBreakdown > 0) {
        iapScore = sumBreakdown;
      }
      if (invalidated) iapScore = 0;

      // Derivar dictamen del rango si no llego o es invalido
      let dictamen: IapDictamen;
      if (invalidated) {
        dictamen = 'PRUEBA_INVALIDADA';
      } else if (validDictamenes.includes(parsed.dictamen)) {
        dictamen = parsed.dictamen as IapDictamen;
      } else if (iapScore >= 85) {
        dictamen = 'APTO_EXCELENTE';
      } else if (iapScore >= 70) {
        dictamen = 'APTO_CON_RESERVAS';
      } else if (iapScore >= 55) {
        dictamen = 'NO_APTO_DESARROLLABLE';
      } else {
        dictamen = 'NO_APTO_RIESGO';
      }

      return {
        calificacion,
        iapScore,
        iapBreakdown,
        dictamen,
        invalidated,
        invalidationReasons,
        resumen:
          typeof parsed.resumen === 'string'
            ? parsed.resumen
            : 'No se pudo generar un resumen.',
        fortalezas: Array.isArray(parsed.fortalezas)
          ? parsed.fortalezas.filter((f: unknown) => typeof f === 'string')
          : [],
        riesgos: Array.isArray(parsed.riesgos)
          ? parsed.riesgos.filter((r: unknown) => typeof r === 'string')
          : [],
        observaciones: Array.isArray(parsed.observaciones)
          ? parsed.observaciones.filter((o: unknown) => typeof o === 'string')
          : [],
      };
    } catch (error) {
      this.logger.error('Error parseando respuesta DeepSeek', error);
      return {
        calificacion: 'APTITUD_MEDIA',
        iapScore: 0,
        iapBreakdown: { pf16: 0, disc: 0, valanti: 0, kostick: 0 },
        dictamen: 'PRUEBA_INVALIDADA',
        invalidated: true,
        invalidationReasons: ['Respuesta del modelo no pudo ser interpretada'],
        resumen:
          'Error al procesar la respuesta de la IA. Se requiere revision manual.',
        fortalezas: [],
        riesgos: ['No se pudo completar el analisis automatizado.'],
        observaciones: [
          'La respuesta del modelo no pudo ser interpretada correctamente.',
        ],
      };
    }
  }
}
