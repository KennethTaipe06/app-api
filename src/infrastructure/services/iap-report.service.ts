import { Injectable } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  PageOrientation,
  LevelFormat,
} from 'docx';

export interface IapReportCandidate {
  rank: number | null;
  candidate: {
    firstName: string;
    lastName: string;
    cedula: string;
    email: string;
  };
  batteryComplete: boolean;
  iapScore: number | null;
  iapBreakdown: {
    pf16: number;
    disc: number;
    valanti: number;
    kostick: number;
  } | null;
  dictamen: string | null;
  dictamenLabel: string | null;
  apto: boolean | null;
  invalidated: boolean;
  invalidationReasons: string[];
  calificacion: string | null;
  resumen: string | null;
  fortalezas: string[];
  riesgos: string[];
  observaciones: string[];
  generatedAt: Date | string | null;
}

export interface IapReportInput {
  scheduledExam: {
    title: string;
    scheduledAt: Date | string;
    status: string;
  };
  summary: {
    total: number;
    evaluated: number;
    aptos: number;
    noAptos: number;
    pendientes: number;
  };
  ranking: IapReportCandidate[];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const cellBorders = {
  top: border,
  bottom: border,
  left: border,
  right: border,
};

@Injectable()
export class IapReportService {
  async buildDocx(input: IapReportInput): Promise<Buffer> {
    const sections: Paragraph[] = [];

    // ── Portada ──
    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: 'Reporte IAP - Indice de Adecuacion al Puesto',
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: input.scheduledExam.title,
            bold: true,
            size: 28,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Programado: ${new Date(input.scheduledExam.scheduledAt).toLocaleString('es-EC')}`,
            color: '595959',
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Estado: ${input.scheduledExam.status} - Generado: ${new Date().toLocaleString('es-EC')}`,
            color: '595959',
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun('')] }),
    );

    // ── Resumen ──
    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({ text: 'Resumen de la evaluacion', bold: true }),
        ],
      }),
    );

    const summaryTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3744, 1872, 1872, 1872],
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Total', 'Evaluados', 'Aptos', 'No aptos'].map(
            (h) =>
              new TableCell({
                borders: cellBorders,
                width: { size: 1872, type: WidthType.DXA },
                shading: { fill: 'E7E6E6', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: h, bold: true })],
                  }),
                ],
              }),
          ),
        }),
        new TableRow({
          children: [
            input.summary.total,
            input.summary.evaluated,
            input.summary.aptos,
            input.summary.noAptos,
          ].map(
            (v) =>
              new TableCell({
                borders: cellBorders,
                width: { size: 1872, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(v), size: 28 })],
                  }),
                ],
              }),
          ),
        }),
      ],
    });

    // ── Tabla de ranking ──
    const rankingHeader = new TableRow({
      tableHeader: true,
      children: [
        '#',
        'Candidato',
        'Cedula',
        'IAP',
        'Desglose (PF/D/V/K)',
        'Dictamen',
        'Apto',
      ].map(
        (h) =>
          new TableCell({
            borders: cellBorders,
            shading: { fill: 'E7E6E6', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, size: 18 })],
              }),
            ],
          }),
      ),
    });

    const rankingRows = input.ranking.map((row) => {
      const breakdown = row.iapBreakdown
        ? `${row.iapBreakdown.pf16}/25 - ${row.iapBreakdown.disc}/15 - ${row.iapBreakdown.valanti}/30 - ${row.iapBreakdown.kostick}/30`
        : '—';
      const iap = row.iapScore != null ? `${row.iapScore}/100` : 'Pendiente';
      const dictamen =
        row.dictamenLabel ||
        (row.dictamen ? row.dictamen.replace(/_/g, ' ') : 'Pendiente');
      const apto =
        row.apto === true ? 'Apto' : row.apto === false ? 'No apto' : '—';
      const aptoColor =
        row.apto === true ? '2E7D32' : row.apto === false ? 'C62828' : '757575';

      return new TableRow({
        children: [
          String(row.rank ?? '—'),
          `${row.candidate.firstName} ${row.candidate.lastName}`,
          row.candidate.cedula,
          iap,
          breakdown,
          dictamen,
          apto,
        ].map(
          (text, idx) =>
            new TableCell({
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      size: 18,
                      bold: idx === 6,
                      color: idx === 6 ? aptoColor : undefined,
                    }),
                  ],
                }),
              ],
            }),
        ),
      });
    });

    const rankingTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [600, 2200, 1200, 800, 1860, 1900, 800],
      rows: [rankingHeader, ...rankingRows],
    });

    // ── Hallazgos por candidato ──
    const detailParagraphs: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({ text: 'Hallazgos por candidato', bold: true }),
        ],
      }),
    ];

    for (const row of input.ranking) {
      detailParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text: `${row.rank ?? '—'}. ${row.candidate.firstName} ${row.candidate.lastName} (C.I. ${row.candidate.cedula})`,
              bold: true,
            }),
          ],
        }),
      );

      if (row.invalidated) {
        detailParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'PRUEBA INVALIDADA',
                bold: true,
                color: 'C62828',
              }),
            ],
          }),
        );
        for (const reason of row.invalidationReasons) {
          detailParagraphs.push(
            new Paragraph({
              numbering: { reference: 'bullets', level: 0 },
              children: [new TextRun({ text: reason })],
            }),
          );
        }
      } else if (row.iapScore == null) {
        detailParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: row.batteryComplete
                  ? 'Pendiente: bateria completa pero IA no generada.'
                  : 'Pendiente: bateria incompleta.',
                italics: true,
                color: '8A6D00',
              }),
            ],
          }),
        );
      } else {
        // IAP linea
        detailParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'IAP: ', bold: true }),
              new TextRun({ text: `${row.iapScore}/100` }),
              new TextRun({ text: ' - Dictamen: ', bold: true }),
              new TextRun({
                text: row.dictamenLabel || row.dictamen || '—',
              }),
              new TextRun({ text: ' - Apto: ', bold: true }),
              new TextRun({
                text:
                  row.apto === true
                    ? 'Apto'
                    : row.apto === false
                      ? 'No apto'
                      : '—',
                bold: true,
                color:
                  row.apto === true
                    ? '2E7D32'
                    : row.apto === false
                      ? 'C62828'
                      : '757575',
              }),
            ],
          }),
        );

        if (row.iapBreakdown) {
          detailParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Desglose: ', bold: true }),
                new TextRun({
                  text: `16PF ${row.iapBreakdown.pf16}/25, DISC ${row.iapBreakdown.disc}/15, Valanti ${row.iapBreakdown.valanti}/30, Kostick ${row.iapBreakdown.kostick}/30`,
                }),
              ],
            }),
          );
        }

        if (row.resumen) {
          detailParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Resumen: ', bold: true }),
                new TextRun({ text: row.resumen }),
              ],
            }),
          );
        }

        if (row.fortalezas.length > 0) {
          detailParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Fortalezas',
                  bold: true,
                  color: '2E7D32',
                }),
              ],
            }),
          );
          for (const f of row.fortalezas) {
            detailParagraphs.push(
              new Paragraph({
                numbering: { reference: 'bullets', level: 0 },
                children: [new TextRun({ text: f })],
              }),
            );
          }
        }

        if (row.riesgos.length > 0) {
          detailParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Factores de riesgo',
                  bold: true,
                  color: 'C62828',
                }),
              ],
            }),
          );
          for (const r of row.riesgos) {
            detailParagraphs.push(
              new Paragraph({
                numbering: { reference: 'bullets', level: 0 },
                children: [new TextRun({ text: r })],
              }),
            );
          }
        }

        if (row.observaciones.length > 0) {
          detailParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Observaciones',
                  bold: true,
                  color: '595959',
                }),
              ],
            }),
          );
          for (const o of row.observaciones) {
            detailParagraphs.push(
              new Paragraph({
                numbering: { reference: 'bullets', level: 0 },
                children: [new TextRun({ text: o, italics: true })],
              }),
            );
          }
        }
      }

      detailParagraphs.push(new Paragraph({ children: [new TextRun('')] }));
    }

    // ── Leyenda IAP ──
    detailParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'Tabla de decision IAP', bold: true })],
      }),
      new Paragraph({
        children: [new TextRun('85 - 100  Apto / Excelente ajuste')],
      }),
      new Paragraph({ children: [new TextRun('70 -  84  Apto con reservas')] }),
      new Paragraph({
        children: [new TextRun('55 -  69  No apto (desarrollable)')],
      }),
      new Paragraph({ children: [new TextRun(' 0 -  54  No apto (riesgo)')] }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Filtros de invalidacion: 16PF C=Q4=10, tiempo <40% del estandar, proctoring >15 alertas.',
            italics: true,
            color: '595959',
          }),
        ],
      }),
    );

    const doc = new Document({
      creator: 'MindTalent',
      title: `IAP - ${input.scheduledExam.title}`,
      styles: {
        default: { document: { run: { font: 'Calibri', size: 22 } } },
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { size: 36, bold: true, color: '1F3864' },
            paragraph: { spacing: { before: 240, after: 200 } },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { size: 28, bold: true, color: '2E5496' },
            paragraph: { spacing: { before: 220, after: 160 } },
          },
          {
            id: 'Heading3',
            name: 'Heading 3',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: { size: 24, bold: true, color: '1F3864' },
            paragraph: { spacing: { before: 180, after: 120 } },
          },
        ],
      },
      numbering: {
        config: [
          {
            reference: 'bullets',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: { indent: { left: 720, hanging: 360 } },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240,
                height: 15840,
                orientation: PageOrientation.PORTRAIT,
              },
              margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
            },
          },
          children: [
            ...sections,
            summaryTable,
            new Paragraph({ children: [new TextRun('')] }),
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: 'Ranking por IAP', bold: true })],
            }),
            rankingTable,
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Criterio de evaluacion: APTO = IAP >= 70 (bandas "Apto / Excelente" y "Apto con reservas"). NO APTO = IAP < 70 (bandas "No apto desarrollable" y "No apto riesgo"). Las pruebas invalidadas no aplican (16PF C=Q4=10, tiempo <40% del estandar, o proctoring >15 alertas).',
                  italics: true,
                  size: 18,
                  color: '595959',
                }),
              ],
            }),
            new Paragraph({ children: [new TextRun('')] }),
            ...detailParagraphs,
          ],
        },
      ],
    });

    return Packer.toBuffer(doc) as unknown as Promise<Buffer>;
  }
}
