import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ReportData {
  candidateName: string;
  candidateCedula: string;
  testName: string;
  testType: string;
  completedAt: string;
  totalScore: number;
  percentile: number;
  category: string;
  timeSpentMin: number;
  scales: {
    name: string;
    code: string;
    rawScore: number;
    stenScore: number;
    percentile: number;
    category: string;
  }[];
}

@Injectable()
export class ExcelService {
  async generateIndividualReport(data: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MindTalent';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Resultado Individual');

    // Header
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'INFORME DE EVALUACION PSICOMETRICA';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = 'MindTalent - Policia Nacional del Ecuador';
    subtitleCell.font = { size: 12, color: { argb: 'FF666666' } };
    subtitleCell.alignment = { horizontal: 'center' };

    // Candidate info
    const infoStart = 4;
    const infoLabels = [
      ['Candidato:', data.candidateName],
      ['Cedula:', data.candidateCedula],
      ['Test:', data.testName],
      ['Tipo:', data.testType],
      ['Fecha:', data.completedAt],
      ['Tiempo:', `${data.timeSpentMin} minutos`],
      ['Puntaje Total:', data.totalScore.toString()],
      ['Percentil:', `${data.percentile}%`],
      ['Categoria:', data.category],
    ];

    infoLabels.forEach(([label, value], idx) => {
      const row = sheet.getRow(infoStart + idx);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = value;
    });

    // Scales table
    const tableStart = infoStart + infoLabels.length + 2;
    const headerRow = sheet.getRow(tableStart);
    const headers = [
      'Escala',
      'Codigo',
      'Puntaje Bruto',
      'STEN',
      'Percentil',
      'Categoria',
    ];
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    data.scales.forEach((scale, idx) => {
      const row = sheet.getRow(tableStart + 1 + idx);
      row.getCell(1).value = scale.name;
      row.getCell(2).value = scale.code;
      row.getCell(3).value = scale.rawScore;
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).value = scale.stenScore;
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).value = scale.percentile;
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).value = scale.category;
      row.getCell(6).alignment = { horizontal: 'center' };

      // Color por categoria
      const catColor =
        scale.category === 'Alto'
          ? 'FF28A745'
          : scale.category === 'Bajo'
            ? 'FFDC3545'
            : 'FFFFC107';
      row.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: catColor },
      };
      row.getCell(6).font = {
        color: { argb: scale.category === 'Medio' ? 'FF000000' : 'FFFFFFFF' },
      };

      // Borders
      for (let c = 1; c <= 6; c++) {
        row.getCell(c).border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    });

    // Column widths
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 10;
    sheet.getColumn(5).width = 12;
    sheet.getColumn(6).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateGroupReport(
    testName: string,
    results: ReportData[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MindTalent';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Resultados Grupales');

    // Header
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `REPORTE GRUPAL - ${testName.toUpperCase()}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:H2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `${results.length} candidatos evaluados | Generado: ${new Date().toLocaleDateString('es-EC')}`;
    subtitleCell.font = { size: 11, color: { argb: 'FF666666' } };
    subtitleCell.alignment = { horizontal: 'center' };

    // Table headers
    const headerRow = sheet.getRow(4);
    const headers = [
      '#',
      'Candidato',
      'Cedula',
      'Fecha',
      'Tiempo (min)',
      'Puntaje',
      'Percentil',
      'Categoria',
    ];
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    results.forEach((r, idx) => {
      const row = sheet.getRow(5 + idx);
      row.getCell(1).value = idx + 1;
      row.getCell(2).value = r.candidateName;
      row.getCell(3).value = r.candidateCedula;
      row.getCell(4).value = r.completedAt;
      row.getCell(5).value = r.timeSpentMin;
      row.getCell(6).value = r.totalScore;
      row.getCell(7).value = r.percentile;
      row.getCell(8).value = r.category;

      for (let c = 1; c <= 8; c++) {
        row.getCell(c).alignment = { horizontal: 'center' };
        row.getCell(c).border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
      row.getCell(2).alignment = { horizontal: 'left' };
    });

    // Column widths
    [5, 30, 15, 15, 15, 12, 12, 12].forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
