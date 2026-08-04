/**
 * Excel multi-sheet helpers for the bulk lead importer.
 * - Scores sheets by how much they look like a header + data table
 * - Auto-picks the best sheet when the first sheet is notes/text
 */

export type ExcelCell = string | number | boolean | Date | null | undefined;
export type ExcelRow = ExcelCell[];
export type ExcelSheetRaw = { sheet: string; data: ExcelRow[] };

export type ExcelSheetMeta = {
  name: string;
  index: number; // 0-based
  rowCount: number;
  colCount: number;
  score: number;
  looksLikeTable: boolean;
};

export type ParsedSheetTable = {
  headers: string[];
  rawHeaders: string[];
  dataRows: Record<string, string>[];
};

const HEADER_HINT =
  /^(name|full.?name|first.?name|last.?name|email|e-?mail|phone|mobile|cell|company|organisation|organization|city|state|country|stage|segment|notes?|status|address|abn|age|title|job)/i;

function cellText(value: ExcelCell): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function nonEmptyCount(row: ExcelRow | undefined): number {
  if (!Array.isArray(row)) return 0;
  return row.reduce<number>((n, cell) => (cellText(cell) ? n + 1 : n), 0);
}

/** Find the first row that looks like a header row (several filled cells). */
export function findHeaderRowIndex(data: ExcelRow[]): number {
  const limit = Math.min(data.length, 25);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i += 1) {
    const row = data[i] || [];
    const filled = nonEmptyCount(row);
    if (filled < 2) continue;
    let score = filled * 10;
    // Prefer rows whose cells look like field names rather than long prose.
    for (const cell of row) {
      const t = cellText(cell);
      if (!t) continue;
      if (HEADER_HINT.test(t)) score += 8;
      if (t.length > 80) score -= 12; // long text → unlikely a column header
      if (/\s{2,}/.test(t) && t.length > 40) score -= 6;
      if (/^[A-Za-z][A-Za-z0-9_ /&().-]{0,40}$/.test(t)) score += 2;
    }
    // Prefer earlier rows slightly when scores are close
    score -= i * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Score how much a sheet looks like importable tabular lead data.
 * Higher = better candidate. Sheets of pure notes score low.
 */
export function scoreSheetData(data: ExcelRow[]): { score: number; looksLikeTable: boolean; headerRowIndex: number } {
  if (!Array.isArray(data) || data.length === 0) {
    return { score: 0, looksLikeTable: false, headerRowIndex: 0 };
  }

  const headerRowIndex = findHeaderRowIndex(data);
  const headerRow = data[headerRowIndex] || [];
  const headerFilled = nonEmptyCount(headerRow);
  if (headerFilled < 2) {
    return { score: 0, looksLikeTable: false, headerRowIndex };
  }

  let headerHints = 0;
  for (const cell of headerRow) {
    const t = cellText(cell);
    if (HEADER_HINT.test(t)) headerHints += 1;
  }

  let dataRows = 0;
  let denseDataRows = 0;
  for (let i = headerRowIndex + 1; i < data.length; i += 1) {
    const filled = nonEmptyCount(data[i]);
    if (filled === 0) continue;
    dataRows += 1;
    if (filled >= Math.min(2, headerFilled)) denseDataRows += 1;
  }

  let score = 0;
  score += Math.min(headerFilled, 12) * 4;
  score += headerHints * 15;
  score += Math.min(dataRows, 200) * 2;
  score += Math.min(denseDataRows, 200) * 3;
  // Penalty: almost no data under headers (likely a title/notes sheet)
  if (dataRows === 0) score -= 40;
  if (headerHints === 0 && dataRows < 3) score -= 20;

  const looksLikeTable = headerFilled >= 2 && dataRows >= 1 && (headerHints >= 1 || denseDataRows >= 2);
  return { score: Math.max(0, score), looksLikeTable, headerRowIndex };
}

export function buildSheetMetas(sheets: ExcelSheetRaw[]): ExcelSheetMeta[] {
  return sheets.map((s, index) => {
    const data = Array.isArray(s.data) ? s.data : [];
    const { score, looksLikeTable } = scoreSheetData(data);
    const colCount = data.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    return {
      name: String(s.sheet || `Sheet ${index + 1}`),
      index,
      rowCount: data.length,
      colCount,
      score,
      looksLikeTable,
    };
  });
}

/** Pick the best sheet index for lead import (highest score; prefer looksLikeTable). */
export function pickBestSheetIndex(sheets: ExcelSheetRaw[]): number {
  if (!sheets.length) return 0;
  const metas = buildSheetMetas(sheets);
  let best = 0;
  for (let i = 1; i < metas.length; i += 1) {
    const a = metas[best];
    const b = metas[i];
    if (b.looksLikeTable && !a.looksLikeTable) {
      best = i;
      continue;
    }
    if (b.looksLikeTable === a.looksLikeTable && b.score > a.score) {
      best = i;
    }
  }
  return best;
}

/** Convert a raw sheet matrix into headers + row objects for the importer. */
export function sheetMatrixToTable(data: ExcelRow[]): ParsedSheetTable {
  if (!Array.isArray(data) || data.length === 0) {
    return { headers: [], rawHeaders: [], dataRows: [] };
  }

  const headerRowIndex = findHeaderRowIndex(data);
  const headerSource = data[headerRowIndex] || [];
  const rawHeaders = headerSource.map(h => cellText(h));
  const headers = rawHeaders.filter(Boolean);

  const dataRows = data
    .slice(headerRowIndex + 1)
    .map((row, i) => {
      const item: Record<string, string> = { id: `row-${i}` };
      rawHeaders.forEach((h, j) => {
        if (!h) return;
        const cell = row?.[j];
        item[h] = cellText(cell);
      });
      return item;
    })
    .filter(row =>
      Object.entries(row).some(([k, v]) => k !== 'id' && Boolean(v)),
    );

  return { headers, rawHeaders, dataRows };
}

export function applyExcelSheetToImporter(
  sheets: ExcelSheetRaw[],
  sheetIndex: number,
): ParsedSheetTable & { sheetName: string; meta: ExcelSheetMeta[] } {
  const safeIndex = Math.max(0, Math.min(sheetIndex, Math.max(0, sheets.length - 1)));
  const sheet = sheets[safeIndex];
  const table = sheetMatrixToTable(sheet?.data || []);
  return {
    ...table,
    sheetName: String(sheet?.sheet || `Sheet ${safeIndex + 1}`),
    meta: buildSheetMetas(sheets),
  };
}
