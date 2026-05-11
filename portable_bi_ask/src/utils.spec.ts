import { describe, expect,it } from 'vitest';

import {
  detectDateFormat,
  escapeSqlString,
  fieldKey,
  formatValue,
  norm,
  numberValue,
  quoteIdent,
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
});

describe('toRows()', () => {
  it('calls .toArray() when available', () => {
    const result = { toArray: () => [{ value: 1 }] };
    expect(toRows(result)).toEqual([{ value: 1 }]);
  });

  it('uses .rows property when no .toArray()', () => {
    expect(toRows({ rows: [{ value: 2 }] })).toEqual([{ value: 2 }]);
  });

  it('accepts a plain array', () => {
    expect(toRows([{ value: 3 }])).toEqual([{ value: 3 }]);
  });

  it('returns empty array for null or undefined', () => {
    expect(toRows(null)).toEqual([]);
    expect(toRows(undefined)).toEqual([]);
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
});
