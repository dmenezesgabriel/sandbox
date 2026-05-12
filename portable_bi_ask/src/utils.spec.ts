import { describe, expect, it, vi } from 'vitest';

import {
  addDays,
  addMonths,
  asIsoDate,
  compact,
  cosineSimilarity,
  detectDateFormat,
  escapeRegExp,
  escapeSqlString,
  fieldKey,
  formatValue,
  isDateName,
  isIdLike,
  isNumericType,
  isoDate,
  norm,
  numberValue,
  quoteIdent,
  safeAlias,
  singularize,
  startOfMonth,
  startOfYear,
  toRows,
} from './utils';

describe('norm()', () => {
  it('lowercases and strips accents', () => {
    expect(norm('Região')).toBe('regiao');
  });

  it('collapses non-alphanumeric runs to single space and trims', () => {
    expect(norm('  Sales  (Total) ')).toBe('sales total');
  });

  it('returns empty string for falsy input', () => {
    expect(norm('')).toBe('');
    expect(norm(null)).toBe('');
    expect(norm(undefined)).toBe('');
    expect(norm(0)).toBe('');
  });
});

describe('quoteIdent()', () => {
  it('wraps the identifier in double-quotes', () => {
    expect(quoteIdent('Customer ID')).toBe('"Customer ID"');
  });

  it('escapes embedded double-quotes by doubling them', () => {
    expect(quoteIdent('col"name')).toBe('"col""name"');
  });
});

describe('escapeSqlString()', () => {
  it('doubles single-quotes for safe SQL embedding', () => {
    expect(escapeSqlString("O'Brien")).toBe("O''Brien");
  });

  it('handles strings without single quotes', () => {
    expect(escapeSqlString('hello')).toBe('hello');
  });

  it('converts non-string values to string', () => {
    expect(escapeSqlString(42)).toBe('42');
    expect(escapeSqlString(null)).toBe('null');
  });
});

describe('formatValue()', () => {
  it('formats currency as rounded dollar amount', () => {
    expect(formatValue(1234.56, 'currency')).toBe('$1,235');
  });

  it('formats percent with one decimal place', () => {
    expect(formatValue(0.365, 'percent')).toBe('36.5%');
  });

  it('returns locale number string for plain numbers', () => {
    expect(formatValue(1000)).toBe('1,000');
  });

  it('returns the raw string for non-numeric values', () => {
    expect(formatValue('West', undefined)).toBe('West');
  });

  it('handles zero values in each format', () => {
    expect(formatValue(0, 'currency')).toBe('$0');
    expect(formatValue(0, 'percent')).toBe('0.0%');
    expect(formatValue(0)).toBe('0');
  });

  it('handles negative values', () => {
    expect(formatValue(-500, 'currency')).toBe('$-500');
    expect(formatValue(-0.5, 'percent')).toBe('-50.0%');
  });

  it('handles null and undefined value with no format', () => {
    expect(formatValue(null)).toBe('0');
    expect(formatValue(undefined)).toBe('0');
  });

  it('returns $0 for non-numeric string with currency format', () => {
    expect(formatValue('abc', 'currency')).toBe('$0');
  });

  it('returns $0 for null and undefined with currency format', () => {
    expect(formatValue(null, 'currency')).toBe('$0');
    expect(formatValue(undefined, 'currency')).toBe('$0');
  });
});

describe('fieldKey()', () => {
  it('joins table and column with "::"', () => {
    expect(fieldKey('customer', 'Region')).toBe('customer::Region');
  });
});

describe('detectDateFormat()', () => {
  it('detects DD-MM-YYYY from samples', () => {
    expect(detectDateFormat(['15-01-2017', '20-02-2017'])).toBe('%d-%m-%Y');
  });

  it('detects YYYY-MM-DD from samples', () => {
    expect(detectDateFormat(['2017-01-15', '2017-02-20'])).toBe('%Y-%m-%d');
  });

  it('returns null for empty samples', () => {
    expect(detectDateFormat([])).toBeNull();
  });

  it('returns null for samples below 60% match threshold', () => {
    expect(detectDateFormat(['15-01-2017', 'not-a-date'])).toBeNull();
  });

  it('detects MM/DD/YYYY format', () => {
    expect(detectDateFormat(['01/15/2017', '02/20/2017'])).toBe('%m/%d/%Y');
  });

  it('detects DD/MM/YYYY format', () => {
    expect(detectDateFormat(['15/01/2017', '20/02/2017'])).toBe('%d/%m/%Y');
  });

  it('detects YYYY/MM/DD format', () => {
    expect(detectDateFormat(['2017/01/15', '2017/02/20'])).toBe('%Y/%m/%d');
  });

  it('handles boundary dates (year 1900, 2200; month 1, 12; day 1, 31)', () => {
    const result = detectDateFormat(['01-01-1900', '31-12-2200']);
    expect(result).toBe('%d-%m-%Y');
  });

  it('rejects dates with invalid month or day', () => {
    expect(detectDateFormat(['15-13-2017'])).toBeNull();
    expect(detectDateFormat(['32-01-2017'])).toBeNull();
  });
});

describe('toRows()', () => {
  it('calls .toArray() when available', () => {
    const toArray = vi.fn(() => [{ value: 1 }]);
    const result = { toArray };
    const rows = toRows(result);
    expect(rows).toEqual([{ value: 1 }]);
    expect(rows).toHaveLength(1);
    expect(toArray).toHaveBeenCalledTimes(1);
  });

  it('prefers toArray over rows property', () => {
    const toArray = vi.fn(() => [{ value: 1 }]);
    const result = { toArray, rows: [{ value: 2 }] };
    expect(toRows(result)).toEqual([{ value: 1 }]);
    expect(toArray).toHaveBeenCalledTimes(1);
  });

  it('uses .rows property when no .toArray()', () => {
    const rows = toRows({ rows: [{ value: 2 }] });
    expect(rows).toHaveLength(1);
    expect(rows).toEqual([{ value: 2 }]);
  });

  it('accepts a plain array', () => {
    const rows = toRows([{ value: 3 }]);
    expect(rows).toHaveLength(1);
    expect(rows).toEqual([{ value: 3 }]);
  });

  it('returns empty array for null or undefined', () => {
    expect(toRows(null)).toEqual([]);
    expect(toRows(undefined)).toEqual([]);
  });

  it('filters out non-object entries from array result', () => {
    const rows = toRows([{ value: 1 }, 'string', null, { value: 2 }]);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual([{ value: 1 }, { value: 2 }]);
  });
});

describe('numberValue()', () => {
  it('converts bigint to number', () => {
    expect(numberValue(42n)).toBe(42);
  });

  it('returns 0 for null/undefined', () => {
    expect(numberValue(null)).toBe(0);
    expect(numberValue(undefined)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(numberValue('42')).toBe(42);
  });

  it('returns NaN for non-numeric strings', () => {
    expect(numberValue('abc')).toBeNaN();
  });

  it('preserves numeric zero', () => {
    expect(numberValue(0)).toBe(0);
  });

  it('handles boolean false', () => {
    expect(numberValue(false)).toBe(0);
  });
});

describe('compact()', () => {
  it('normalizes and removes all spaces', () => {
    expect(compact('  Sales  (Total) ')).toBe('salestotal');
  });

  it('handles accented characters', () => {
    expect(compact('Região')).toBe('regiao');
  });

  it('returns empty string for falsy input', () => {
    expect(compact(null)).toBe('');
    expect(compact('')).toBe('');
  });
});

describe('escapeRegExp()', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegExp('(sales) [2024]')).toBe('\\(sales\\) \\[2024\\]');
  });

  it('handles non-string input', () => {
    expect(escapeRegExp(null)).toBe('');
    expect(escapeRegExp(42)).toBe('42');
  });
});

describe('singularize()', () => {
  it('replaces "ies" suffix with "y"', () => {
    expect(singularize('categories')).toBe('category');
  });

  it('removes trailing "s"', () => {
    expect(singularize('sales')).toBe('sale');
  });

  it('handles non-string input', () => {
    expect(singularize(null)).toBe('');
    expect(singularize(42)).toBe('42');
  });
});

describe('isIdLike()', () => {
  it('returns true for column names containing "id", "key", "code"', () => {
    expect(isIdLike('customer_id')).toBe(true);
    expect(isIdLike('product_key')).toBe(true);
    expect(isIdLike('postal_code')).toBe(true);
    expect(isIdLike('zip')).toBe(true);
  });

  it('returns true for names ending with " id"', () => {
    expect(isIdLike('order id')).toBe(true);
  });

  it('returns false for regular column names', () => {
    expect(isIdLike('customer_name')).toBe(false);
    expect(isIdLike('sales_amount')).toBe(false);
  });

  it('handles non-string input', () => {
    expect(isIdLike(null)).toBe(false);
    expect(isIdLike(42)).toBe(false);
  });
});

describe('isNumericType()', () => {
  it('returns true for numeric SQL types', () => {
    expect(isNumericType('INTEGER')).toBe(true);
    expect(isNumericType('DOUBLE')).toBe(true);
    expect(isNumericType('DECIMAL(10,2)')).toBe(true);
    expect(isNumericType('BIGINT')).toBe(true);
    expect(isNumericType('SMALLINT')).toBe(true);
    expect(isNumericType('REAL')).toBe(true);
    expect(isNumericType('FLOAT')).toBe(true);
  });

  it('returns false for non-numeric types', () => {
    expect(isNumericType('VARCHAR')).toBe(false);
    expect(isNumericType('DATE')).toBe(false);
  });

  it('handles non-string input', () => {
    expect(isNumericType(null)).toBe(false);
    expect(isNumericType(undefined)).toBe(false);
  });
});

describe('isDateName()', () => {
  it('returns true for date-related column names', () => {
    expect(isDateName('order_date')).toBe(true);
    expect(isDateName('month')).toBe(true);
    expect(isDateName('year')).toBe(true);
    expect(isDateName('timestamp')).toBe(true);
  });

  it('returns false for non-date names', () => {
    expect(isDateName('customer_name')).toBe(false);
    expect(isDateName('sales_amount')).toBe(false);
  });

  it('handles non-string input', () => {
    expect(isDateName(null)).toBe(false);
    expect(isDateName(42)).toBe(false);
  });
});

describe('isoDate()', () => {
  it('formats a Date to ISO date string (YYYY-MM-DD)', () => {
    const date = new Date(Date.UTC(2024, 0, 15));
    expect(isoDate(date)).toBe('2024-01-15');
  });
});

describe('asIsoDate()', () => {
  it('converts Date to ISO date string', () => {
    const date = new Date(Date.UTC(2024, 5, 15));
    expect(asIsoDate(date)).toBe('2024-06-15');
  });

  it('converts number timestamp to ISO date string', () => {
    const timestamp = new Date(Date.UTC(2024, 0, 1)).getTime();
    expect(asIsoDate(timestamp)).toBe('2024-01-01');
  });

  it('extracts YYYY-MM-DD from a string', () => {
    expect(asIsoDate('2024-01-15T10:30:00Z')).toBe('2024-01-15');
  });

  it('returns null for empty input', () => {
    expect(asIsoDate(null)).toBeNull();
    expect(asIsoDate(undefined)).toBeNull();
    expect(asIsoDate('')).toBeNull();
  });

  it('returns null when no date pattern found in string', () => {
    expect(asIsoDate('not-a-date')).toBeNull();
  });
});

describe('addDays()', () => {
  it('adds days to a date', () => {
    const date = new Date(Date.UTC(2024, 0, 1));
    const result = addDays(date, 5);
    expect(result.toISOString()).toBe('2024-01-06T00:00:00.000Z');
  });

  it('subtracts days when negative', () => {
    const date = new Date(Date.UTC(2024, 0, 10));
    const result = addDays(date, -3);
    expect(result.toISOString()).toBe('2024-01-07T00:00:00.000Z');
  });
});

describe('addMonths()', () => {
  it('adds months to a date', () => {
    const date = new Date(Date.UTC(2024, 0, 1));
    const result = addMonths(date, 3);
    expect(result.toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });

  it('subtracts months when negative', () => {
    const date = new Date(Date.UTC(2024, 5, 1));
    const result = addMonths(date, -2);
    expect(result.toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });
});

describe('startOfMonth()', () => {
  it('returns the first day of the month', () => {
    const date = new Date(Date.UTC(2024, 5, 15));
    const result = startOfMonth(date);
    expect(result.toISOString()).toBe('2024-06-01T00:00:00.000Z');
  });
});

describe('startOfYear()', () => {
  it('returns the first day of the year', () => {
    const date = new Date(Date.UTC(2024, 5, 15));
    const result = startOfYear(date);
    expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('safeAlias()', () => {
  it('creates a safe alias from table name and index', () => {
    expect(safeAlias('sales', 0)).toBe('t0_sales');
    expect(safeAlias('customer orders', 1)).toBe('t1_customer_orders');
  });

  it('replaces non-word characters with underscores', () => {
    expect(safeAlias('my-table!', 2)).toBe('t2_my_table_');
  });
});

describe('cosineSimilarity()', () => {
  it('computes cosine similarity between two vectors', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float64Array([1, 0]);
    const b = new Float64Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('handles vectors of different lengths', () => {
    const a = new Float64Array([1, 2]);
    const b = new Float64Array([1, 2, 3]);
    const result = cosineSimilarity(a, b);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 when one vector has zero norm', () => {
    const a = new Float64Array([0, 0]);
    const b = new Float64Array([1, 2]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when both vectors are zero', () => {
    const a = new Float64Array([0, 0]);
    const b = new Float64Array([0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});
