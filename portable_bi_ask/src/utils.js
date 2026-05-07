export const toRows = result => typeof result?.toArray === "function" ? result.toArray() : result?.rows || result || [];
export const quoteIdent = name => `"${String(name).replaceAll('"', '""')}"`;
export const escapeSqlString = value => String(value).replaceAll("'", "''");
export const norm = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
export const compact = value => norm(value).replaceAll(' ', '');
export const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const singularize = value => String(value || '').replace(/ies$/i, 'y').replace(/s$/i, '');
export const isIdLike = name => /(^|\s|_|-)(id|key|code|postal|zip|row)(\s|_|-|$)/i.test(name) || / id$/i.test(name);
export const isNumericType = type => /int|double|float|decimal|numeric|real|hugeint|bigint|smallint|utinyint|uinteger/i.test(type || '');
export const isDateName = name => /date|time|month|year|timestamp/i.test(name || '');
export const numberValue = value => typeof value === 'bigint' ? Number(value) : Number(value || 0);
export const isoDate = date => date.toISOString().slice(0, 10);
export const asIsoDate = value => {
  if (!value) return null;
  if (value instanceof Date) return isoDate(value);
  if (typeof value === 'number') return isoDate(new Date(value));
  const s = String(value);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
};
export const addDays = (date, days) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
export const addMonths = (date, months) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
export const startOfMonth = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
export const startOfYear = date => new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

export function formatValue(value, format) {
  const n = numberValue(value);
  if (format === 'currency') return "$" + Math.round(n).toLocaleString();
  if (format === 'percent') return (n * 100).toFixed(1) + "%";
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value ?? '');
}

export function fieldKey(table, column) {
  return `${table}::${column}`;
}

export function safeAlias(tableName, index) {
  return `t${index}_${String(tableName).replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export function detectDateFormat(samples) {
  const values = samples.map(String).filter(Boolean).slice(0, 200);
  if (!values.length) return null;
  const candidates = [
    { fmt: "%Y-%m-%d", re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ['y', 'm', 'd'] },
    { fmt: "%d-%m-%Y", re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: ['d', 'm', 'y'] },
    { fmt: "%m-%d-%Y", re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: ['m', 'd', 'y'] },
    { fmt: "%d/%m/%Y", re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['d', 'm', 'y'] },
    { fmt: "%m/%d/%Y", re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['m', 'd', 'y'] },
    { fmt: "%Y/%m/%d", re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: ['y', 'm', 'd'] }
  ];
  let best = null;
  for (const c of candidates) {
    let score = 0;
    for (const value of values) {
      const m = value.match(c.re);
      if (!m) continue;
      const parts = Object.fromEntries(c.order.map((name, i) => [name, Number(m[i + 1])]));
      if (parts.y >= 1900 && parts.y <= 2200 && parts.m >= 1 && parts.m <= 12 && parts.d >= 1 && parts.d <= 31) score++;
    }
    if (!best || score > best.score) best = { format: c.fmt, score };
  }
  return best && best.score / values.length >= 0.6 ? best.format : null;
}

export const cosineSimilarity = (a, b) => {
  let dot = 0, aNorm = 0, bNorm = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  return aNorm && bNorm ? dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm)) : 0;
};
