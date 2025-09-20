import fs from 'fs';
import path from 'path';
import { logger } from './log.js';

export type CSVRow = Record<string, string>;

export interface CSVTable {
  header: string[];
  rows: CSVRow[];
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseLine(line: string, expectedColumns: number): string[] {
  const values = line.split(',');
  if (values.length !== expectedColumns) {
    throw new Error(`Invalid CSV line column count: expected ${expectedColumns}, got ${values.length} (line: ${line})`);
  }
  return values.map((v) => v.trim());
}

export function parseCSV(content: string): CSVTable {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { header: [], rows: [] };
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseLine(lines[i], header.length);
    const row: CSVRow = {};
    header.forEach((col, idx) => {
      row[col] = values[idx];
    });
    rows.push(row);
  }
  return { header, rows };
}

export function readCSV(filePath: string): CSVTable {
  if (!fs.existsSync(filePath)) {
    return { header: [], rows: [] };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length === 0) {
    return { header: [], rows: [] };
  }
  return parseCSV(content);
}

export function writeCSV(filePath: string, header: string[], rows: CSVRow[]): void {
  ensureDir(filePath);
  const headerLine = header.join(',');
  const lines = [headerLine];
  for (const row of rows) {
    const values = header.map((col) => {
      const value = row[col] ?? '';
      if (value.includes(',') || value.includes('\n')) {
        throw new Error(`CSV value contains unsupported characters: ${value}`);
      }
      return value;
    });
    lines.push(values.join(','));
  }
  const output = `${lines.join('\n')}\n`;
  fs.writeFileSync(filePath, output, 'utf8');
}

export function upsertRows(
  filePath: string,
  header: string[],
  keyColumn: string,
  newRows: CSVRow[],
  sortComparator?: (a: CSVRow, b: CSVRow) => number,
): CSVRow[] {
  const table = readCSV(filePath);
  let effectiveHeader = header;
  if (table.header.length > 0) {
    effectiveHeader = table.header;
    if (effectiveHeader.join(',') !== header.join(',')) {
      logger.warn(`Header mismatch for ${filePath}, using existing header.`);
    }
  }
  const map = new Map<string, CSVRow>();
  for (const row of table.rows) {
    const key = row[keyColumn];
    if (!key) {
      continue;
    }
    map.set(key, row);
  }
  for (const row of newRows) {
    const key = row[keyColumn];
    if (!key) {
      throw new Error(`Missing key column ${keyColumn} in row ${JSON.stringify(row)}`);
    }
    map.set(key, { ...map.get(key), ...row });
  }
  const mergedRows = Array.from(map.values());
  const comparator =
    sortComparator ?? ((a: CSVRow, b: CSVRow) => (a[keyColumn] > b[keyColumn] ? 1 : a[keyColumn] < b[keyColumn] ? -1 : 0));
  mergedRows.sort(comparator);
  writeCSV(filePath, effectiveHeader, mergedRows);
  return mergedRows;
}
