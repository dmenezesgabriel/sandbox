import type { CellValue, DataRow, ValueFormat } from '../types/index';

interface RowResultLike {
  toArray?: () => unknown[];
  rows?: unknown[];
}

function isRowResultLike(result: unknown): result is RowResultLike {
  return typeof result === 'object' && result !== null;
}

function isDataRow(value: unknown): value is DataRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRawRows(result: unknown): unknown[] {
  if (isRowResultLike(result) && typeof result.toArray === 'function')
    return result.toArray() as unknown[];
  if (isRowResultLike(result) && Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result)) return result;
  return [];
}

export const toRows = (result: unknown): DataRow[] => getRawRows(result).filter(isDataRow);

export const quoteIdent = (name: string): string => `"${String(name).replaceAll('"', '""')}"`;
export const escapeSqlString = (value: CellValue): string => String(value).replaceAll("'", "''");
export const norm = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const compact = (value: unknown): string => norm(value).replaceAll(' ', '');
export const escapeRegExp = (value: unknown): string =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const singularize = (value: unknown): string =>
  String(value || '')
    .replace(/ies$/i, 'y')
    .replace(/s$/i, '');
export const isIdLike = (name: unknown): boolean =>
  /(^|\s|_|-)(id|key|code|postal|zip|row)(\s|_|-|$)/i.test(String(name)) ||
  / id$/i.test(String(name));
export const isNumericType = (type: unknown): boolean =>
  /int|double|float|decimal|numeric|real|hugeint|bigint|smallint|utinyint|uinteger/i.test(
    String(type || ''),
  );
export const isDateName = (name: unknown): boolean =>
  /date|time|month|year|timestamp/i.test(String(name || ''));
export const numberValue = (value: CellValue): number =>
  typeof value === 'bigint' ? Number(value) : Number(value || 0);
export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
export const asIsoDate = (value: CellValue): string | null => {
  if (!value) return null;
  if (value instanceof Date) return isoDate(value);
  if (typeof value === 'number') return isoDate(new Date(value));
  const s = String(value);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
};
export const addDays = (date: Date, days: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
export const addMonths = (date: Date, months: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
export const startOfMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
export const startOfYear = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

export function formatValue(value: CellValue, format?: ValueFormat): string {
  const n = numberValue(value);
  if (format === 'currency') return '$' + (Number.isNaN(n) ? '0' : Math.round(n).toLocaleString());
  if (format === 'percent') return (n * 100).toFixed(1) + '%';
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value ?? '');
}

export function fieldKey(table: string, column: string): string {
  return `${table}::${column}`;
}

export function safeAlias(tableName: string, index: number): string {
  return `t${index}_${String(tableName).replace(/\W/g, '_')}`;
}

export function detectDateFormat(samples: CellValue[]): string | null {
  const values = samples.map(String).filter(Boolean).slice(0, 200);
  if (!values.length) return null;
  const candidates = [
    { fmt: '%Y-%m-%d', re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ['y', 'm', 'd'] },
    { fmt: '%d-%m-%Y', re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: ['d', 'm', 'y'] },
    { fmt: '%m-%d-%Y', re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: ['m', 'd', 'y'] },
    { fmt: '%d/%m/%Y', re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['d', 'm', 'y'] },
    { fmt: '%m/%d/%Y', re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['m', 'd', 'y'] },
    { fmt: '%Y/%m/%d', re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: ['y', 'm', 'd'] },
  ];
  let best: { format: string; score: number } | null = null;
  for (const c of candidates) {
    let score = 0;
    for (const value of values) {
      const m = value.match(c.re);
      if (!m) continue;
      const parts: Record<string, number> = Object.fromEntries(
        c.order.map((name, i) => [name, Number(m[i + 1])]),
      ) as Record<string, number>;
      if (
        (parts.y ?? 0) >= 1900 &&
        (parts.y ?? 0) <= 2200 &&
        (parts.m ?? 0) >= 1 &&
        (parts.m ?? 0) <= 12 &&
        (parts.d ?? 0) >= 1 &&
        (parts.d ?? 0) <= 31
      )
        score++;
    }
    if (!best || score > best.score) best = { format: c.fmt, score };
  }
  return best && best.score / values.length >= 0.6 ? best.format : null;
}

export const cosineSimilarity = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  return aNorm && bNorm ? dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm)) : 0;
};
