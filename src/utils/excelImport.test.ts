import { describe, expect, it } from 'vitest';
import {
  findHeaderRowIndex,
  scoreSheetData,
  pickBestSheetIndex,
  sheetMatrixToTable,
  applyExcelSheetToImporter,
  type ExcelSheetRaw,
} from './excelImport';

describe('excel multi-sheet import', () => {
  it('finds header row below title text', () => {
    const data = [
      ['Instructions: please fill the table below'],
      [],
      ['Name', 'Email', 'Phone', 'City'],
      ['Ada', 'ada@example.com', '111', 'Sydney'],
    ];
    expect(findHeaderRowIndex(data)).toBe(2);
  });

  it('scores a real data sheet higher than a notes sheet', () => {
    const notes = scoreSheetData([
      ['Welcome to our lead template'],
      ['Read this carefully before filling data on sheet 2'],
      ['Contact support if needed'],
    ]);
    const table = scoreSheetData([
      ['Name', 'Email', 'Phone', 'City'],
      ['Ada', 'ada@example.com', '111', 'Sydney'],
      ['Bob', 'bob@example.com', '222', 'Melbourne'],
    ]);
    expect(table.looksLikeTable).toBe(true);
    expect(table.score).toBeGreaterThan(notes.score);
  });

  it('auto-picks the data sheet when sheet 1 is text', () => {
    const sheets: ExcelSheetRaw[] = [
      {
        sheet: 'Readme',
        data: [
          ['Please use the Data sheet'],
          ['Do not edit this page'],
        ],
      },
      {
        sheet: 'Data',
        data: [
          ['Name', 'Email', 'Phone'],
          ['Ada', 'ada@example.com', '111'],
          ['Bob', 'bob@example.com', '222'],
        ],
      },
    ];
    expect(pickBestSheetIndex(sheets)).toBe(1);
  });

  it('converts matrix to headers and data rows', () => {
    const table = sheetMatrixToTable([
      ['Name', 'Email', 'Phone'],
      ['Ada', 'ada@example.com', '111'],
      ['', '', ''],
      ['Bob', 'bob@example.com', '222'],
    ]);
    expect(table.headers).toEqual(['Name', 'Email', 'Phone']);
    expect(table.dataRows).toHaveLength(2);
    expect(table.dataRows[0].Name).toBe('Ada');
    expect(table.dataRows[1].Email).toBe('bob@example.com');
  });

  it('applyExcelSheetToImporter returns selected sheet name and meta', () => {
    const sheets: ExcelSheetRaw[] = [
      { sheet: 'A', data: [['x']] },
      {
        sheet: 'Leads',
        data: [
          ['Name', 'Email'],
          ['Ada', 'a@b.c'],
        ],
      },
    ];
    const result = applyExcelSheetToImporter(sheets, 1);
    expect(result.sheetName).toBe('Leads');
    expect(result.headers).toContain('Name');
    expect(result.meta).toHaveLength(2);
    expect(result.meta[1].looksLikeTable).toBe(true);
  });
});
