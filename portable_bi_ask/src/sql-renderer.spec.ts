import { describe, expect, it } from 'vitest';

import { SqlRenderer } from './sql-renderer';

describe('SqlRenderer', () => {
  describe('renderCondition()', () => {
    it('renders eq condition with quoted column', () => {
      const renderer = new SqlRenderer();
      expect(
        renderer.renderCondition({ kind: 'eq', tableAlias: 't0', column: 'Region', value: 'East' }),
      ).toBe(`t0."Region" = 'East'`);
    });

    it('escapes single quotes in eq value', () => {
      const renderer = new SqlRenderer();
      expect(
        renderer.renderCondition({
          kind: 'eq',
          tableAlias: 't0',
          column: 'Name',
          value: "O'Brien",
        }),
      ).toBe(`t0."Name" = 'O''Brien'`);
    });

    it('renders in condition with quoted value list', () => {
      const renderer = new SqlRenderer();
      expect(
        renderer.renderCondition({
          kind: 'in',
          tableAlias: 't0',
          column: 'Region',
          values: ['East', 'West'],
        }),
      ).toBe(`t0."Region" IN ('East', 'West')`);
    });

    it('escapes single quotes in in list values', () => {
      const renderer = new SqlRenderer();
      expect(
        renderer.renderCondition({
          kind: 'in',
          tableAlias: 't0',
          column: 'Name',
          values: ["O'Brien", 'Smith'],
        }),
      ).toBe(`t0."Name" IN ('O''Brien', 'Smith')`);
    });

    it('renders month_of_year as EXTRACT expression', () => {
      const renderer = new SqlRenderer();
      expect(
        renderer.renderCondition({ kind: 'month_of_year', dateExpr: 't0."Order Date"', month: 3 }),
      ).toBe(`EXTRACT(month FROM t0."Order Date") = 3`);
    });
  });

  describe('renderConditions()', () => {
    it('returns empty array for no conditions', () => {
      const renderer = new SqlRenderer();
      expect(renderer.renderConditions([])).toEqual([]);
    });

    it('expands date_range into two WHERE parts', () => {
      const renderer = new SqlRenderer();
      const parts = renderer.renderConditions([
        { kind: 'date_range', dateExpr: 't0."Order Date"', start: '2024-01-01', end: '2024-12-31' },
      ]);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(`t0."Order Date" >= DATE '2024-01-01'`);
      expect(parts[1]).toBe(`t0."Order Date" < DATE '2024-12-31'`);
    });

    it('renders multiple conditions in order', () => {
      const renderer = new SqlRenderer();
      const parts = renderer.renderConditions([
        { kind: 'eq', tableAlias: 't0', column: 'Region', value: 'East' },
        { kind: 'in', tableAlias: 't1', column: 'Category', values: ['A', 'B'] },
      ]);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(`t0."Region" = 'East'`);
      expect(parts[1]).toBe(`t1."Category" IN ('A', 'B')`);
    });

    it('mixes eq and date_range conditions correctly', () => {
      const renderer = new SqlRenderer();
      const parts = renderer.renderConditions([
        { kind: 'eq', tableAlias: 't0', column: 'Region', value: 'East' },
        { kind: 'date_range', dateExpr: 't0."Order Date"', start: '2024-01-01', end: '2024-12-31' },
      ]);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toContain('Region');
      expect(parts[1]).toContain('>= DATE');
      expect(parts[2]).toContain('< DATE');
    });
  });
});
