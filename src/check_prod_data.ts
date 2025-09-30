import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { parseCSV } from './utils/csv.js';

type Row = Record<string, string>;

function buildRowMap(rows: Row[]): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const key = row.day;
    if (!key) {
      continue;
    }
    map.set(key, row);
  }
  return map;
}

function compareRows(day: string, header: string[], local: Row, remote: Row): string[] {
  const mismatches: string[] = [];
  for (const column of header) {
    const localValue = local[column] ?? '';
    const remoteValue = remote[column] ?? '';
    if (localValue !== remoteValue) {
      mismatches.push(`${column}: local=${localValue} remote=${remoteValue}`);
    }
  }
  if (mismatches.length > 0) {
    return [`${day}:`, ...mismatches];
  }
  return [];
}

function fetchRemote(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-Ls', url], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`curl failed: ${error.message} (stderr: ${stderr})`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function main(): Promise<void> {
  const localPath = path.resolve('public/data/nav_wbtc_daily.csv');
  const remoteUrl =
    process.env.PROD_NAV_WBTC_URL ?? 'https://denissilantev64.github.io/VLHXBTC-dashboard/data/nav_wbtc_daily.csv';

  if (!fs.existsSync(localPath)) {
    throw new Error(`Local CSV not found at ${localPath}`);
  }

  const localContent = fs.readFileSync(localPath, 'utf8');
  const remoteContent = await fetchRemote(remoteUrl);

  const localTable = parseCSV(localContent);
  const remoteTable = parseCSV(remoteContent);

  const localMap = buildRowMap(localTable.rows);
  const remoteMap = buildRowMap(remoteTable.rows);

  const missingInRemote: string[] = [];
  const mismatched: string[][] = [];

  for (const [day, localRow] of localMap.entries()) {
    const remoteRow = remoteMap.get(day);
    if (!remoteRow) {
      missingInRemote.push(day);
      continue;
    }
    const rowDiff = compareRows(day, localTable.header, localRow, remoteRow);
    if (rowDiff.length > 0) {
      mismatched.push(rowDiff);
    }
  }

  const additionalRemote: string[] = [];
  for (const day of remoteMap.keys()) {
    if (!localMap.has(day)) {
      additionalRemote.push(day);
    }
  }

  if (missingInRemote.length === 0 && mismatched.length === 0) {
    console.log('All local rows have matching counterparts on production.');
  } else {
    if (missingInRemote.length > 0) {
      console.log('Missing on production:', missingInRemote.sort().join(', '));
    }
    if (mismatched.length > 0) {
      console.log('Mismatched rows:');
      mismatched.forEach((diff) => {
        diff.forEach((line) => console.log(`  ${line}`));
      });
    }
  }

  if (additionalRemote.length > 0) {
    console.log('Production has additional rows:', additionalRemote.sort().join(', '));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
