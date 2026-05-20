import { BadRequestException } from '@nestjs/common';
import { CustomQuestionType } from '../../../domain/enums';
import { CustomQuestionOptionDto } from '../../dtos';

/**
 * Valida la configuracion de opciones de una pregunta segun su tipo.
 * Lanza BadRequestException si la configuracion es invalida.
 */
export function validateQuestionOptions(
  type: CustomQuestionType,
  options: CustomQuestionOptionDto[],
): void {
  if (!options || options.length < 2) {
    throw new BadRequestException(
      'La pregunta debe tener al menos 2 opciones',
    );
  }

  const correctCount = options.filter((o) => o.isCorrect).length;

  switch (type) {
    case CustomQuestionType.TRUE_FALSE:
      if (options.length !== 2) {
        throw new BadRequestException(
          'Verdadero/Falso debe tener exactamente 2 opciones',
        );
      }
      if (correctCount !== 1) {
        throw new BadRequestException(
          'Verdadero/Falso debe tener exactamente 1 opcion correcta',
        );
      }
      break;

    case CustomQuestionType.MULTIPLE_CHOICE_SINGLE:
      if (correctCount !== 1) {
        throw new BadRequestException(
          'Opcion multiple (una respuesta) debe tener exactamente 1 opcion correcta',
        );
      }
      break;

    case CustomQuestionType.MULTIPLE_CHOICE_MULTI:
      if (correctCount < 1) {
        throw new BadRequestException(
          'Opcion multiple (varias respuestas) debe tener al menos 1 opcion correcta',
        );
      }
      break;
  }
}
