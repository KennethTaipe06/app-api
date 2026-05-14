import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface CvEvaluationResult {
  score: number; // 1-100
  justification: string;
}

@Injectable()
export class CvEvaluatorService {
  private readonly logger = new Logger(CvEvaluatorService.name);
  private readonly client: OpenAI;
  private readonly model = 'deepseek-chat';

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'DEEPSEEK_API_KEY no configurada — evaluacion IA de CVs no disponible',
      );
    }
    this.client = new OpenAI({
      apiKey: apiKey || 'missing',
      baseURL: 'https://api.deepseek.com',
    });
  }

  /**
   * Evalua un CV contra el perfil del puesto y retorna score 1-100 + justificacion.
   * Si la IA falla, lanza el error — el caller decide como manejarlo.
   */
  async evaluateCv(input: {
    jobTitle: string;
    jobProfileText: string;
    cvText: string;
    candidateName: string;
  }): Promise<CvEvaluationResult> {
    const prompt = this.buildPrompt(input);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    return this.parseResponse(raw);
  }

  private getSystemPrompt(): string {
    return `Eres un reclutador senior especializado en evaluacion de hojas de vida.
Tu tarea es comparar la HOJA DE VIDA de un candidato contra el PERFIL DE PUESTO requerido y emitir:
  - score: numero entero de 1 a 100 que indica compatibilidad real con el puesto.
  - justification: 2-4 oraciones, en espanol, explicando que sustenta ese puntaje.

Criterios de puntaje:
  - 90-100: cumple o supera todos los requisitos clave (formacion, experiencia, competencias).
  - 75-89: cumple la mayoria; brechas menores.
  - 50-74: cumple parcialmente; brechas relevantes que requieren capacitacion.
  - 25-49: cumple solo aspectos perifericos del puesto.
  - 1-24: no cumple los requisitos minimos.

Si la informacion del CV es insuficiente para evaluar, usa score bajo (1-30) y dilo claramente en la justificacion.
Responde EXCLUSIVAMENTE con un JSON valido: {"score": number, "justification": string}.
No agregues texto fuera del JSON.`;
  }

  private buildPrompt(input: {
    jobTitle: string;
    jobProfileText: string;
    cvText: string;
    candidateName: string;
  }): string {
    return `PUESTO: ${input.jobTitle}

═══════════════════════════════════════════════════════════════
PERFIL DEL PUESTO (requisitos, competencias, responsabilidades)
═══════════════════════════════════════════════════════════════
${input.jobProfileText || '(sin texto disponible)'}

═══════════════════════════════════════════════════════════════
HOJA DE VIDA DEL CANDIDATO: ${input.candidateName}
═══════════════════════════════════════════════════════════════
${input.cvText || '(sin texto disponible)'}

Devuelve el JSON con score (1-100) y justification.`;
  }

  private parseResponse(raw: string): CvEvaluationResult {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Respuesta IA invalida (JSON parse failed)');
    }
    const score = Math.max(1, Math.min(100, Math.round(Number(parsed?.score))));
    if (!Number.isFinite(score)) {
      throw new Error('Respuesta IA sin score numerico valido');
    }
    const justification =
      typeof parsed?.justification === 'string'
        ? parsed.justification.slice(0, 1200)
        : 'Sin justificacion provista por la IA.';
    return { score, justification };
  }
}
