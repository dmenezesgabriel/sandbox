import { describe, expect, it, vi } from 'vitest';

import type {
  DiagnosticDateParse,
  DiagnosticFilterSelectivity,
  DiagnosticJoinFanout,
} from '../../../shared/types/index';
import { DiagnosticRunner } from './diagnostic-runner';

function mockQuery(rows: Record<string, unknown>[][]) {
  const calls = rows;
  let i = 0;
  return vi.fn(async () => {
    const result = calls[i] ?? [];
    i++;
    return result;
  });
}

describe('DiagnosticRunner', () => {
  describe('evaluateJoinFanout', () => {
    it('skips evaluation when baseCountSql is missing', async () => {
      const query = mockQuery([]);
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {};
      await runner.evaluateJoinFanout(fanout);
      expect(query).not.toHaveBeenCalled();
      expect(fanout.baseCount).toBeUndefined();
    });

    it('computes ratio and sets warning when fanout exceeds threshold', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 100 }])
        .mockResolvedValueOnce([{ row_count: 500 }]);
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {
        baseTable: 'orders',
        baseCountSql: 'SELECT COUNT(*) AS row_count FROM orders',
        joinedCountSql: 'SELECT COUNT(*) AS row_count FROM orders JOIN lineitems ON ...',
        threshold: 1.5,
        minExtraRows: 10,
      };
      await runner.evaluateJoinFanout(fanout);
      expect(fanout.baseCount).toBe(100);
      expect(fanout.joinedCount).toBe(500);
      expect(fanout.ratio).toBe(5);
      expect(fanout.warning).toContain('5.0x');
      expect(fanout.warning).toContain('100');
      expect(fanout.warning).toContain('500');
    });

    it('does not set warning when ratio below threshold', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 100 }])
        .mockResolvedValueOnce([{ row_count: 120 }]);
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {
        baseTable: 'orders',
        baseCountSql: 'SELECT COUNT(*) AS row_count FROM orders',
        joinedCountSql: 'SELECT COUNT(*) AS row_count FROM orders JOIN ...',
        threshold: 1.5,
        minExtraRows: 10,
      };
      await runner.evaluateJoinFanout(fanout);
      expect(fanout.ratio).toBe(1.2);
      expect(fanout.warning).toBeUndefined();
    });

    it('does not set warning when extra rows below minExtraRows even with high ratio', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 100 }])
        .mockResolvedValueOnce([{ row_count: 105 }]);
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {
        baseTable: 'orders',
        baseCountSql: 'SELECT COUNT(*) AS row_count FROM orders',
        joinedCountSql: 'SELECT COUNT(*) AS row_count FROM orders JOIN ...',
        threshold: 1.01,
        minExtraRows: 100,
      };
      await runner.evaluateJoinFanout(fanout);
      expect(fanout.warning).toBeUndefined();
    });

    it('handles zero base count with positive joined count', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 0 }])
        .mockResolvedValueOnce([{ row_count: 50 }]);
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {
        baseTable: 'orders',
        baseCountSql: 'SELECT COUNT(*) AS row_count FROM orders',
        joinedCountSql: 'SELECT COUNT(*) AS row_count FROM orders JOIN ...',
        threshold: 1.5,
        minExtraRows: 10,
      };
      await runner.evaluateJoinFanout(fanout);
      expect(fanout.ratio).toBe(Infinity);
    });

    it('sets ratio to 1 when both counts are zero', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 0 }])
        .mockResolvedValueOnce([{ row_count: 0 }]);
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {
        baseTable: 'orders',
        baseCountSql: 'SELECT COUNT(*) AS row_count FROM orders',
        joinedCountSql: 'SELECT COUNT(*) AS row_count FROM orders JOIN ...',
        threshold: 1.5,
        minExtraRows: 0,
      };
      await runner.evaluateJoinFanout(fanout);
      expect(fanout.ratio).toBe(1);
    });

    it('captures query error', async () => {
      const query = vi.fn().mockRejectedValueOnce(new Error('SQL error'));
      const runner = new DiagnosticRunner(query);
      const fanout: DiagnosticJoinFanout = {
        baseTable: 'orders',
        baseCountSql: 'SELECT COUNT(*) AS row_count FROM orders',
        joinedCountSql: 'SELECT COUNT(*) AS row_count FROM orders JOIN ...',
        threshold: 1.5,
        minExtraRows: 10,
      };
      await runner.evaluateJoinFanout(fanout);
      expect(fanout.error).toContain('SQL error');
    });
  });

  describe('evaluateFilterSelectivity', () => {
    it('skips evaluation when SQL is missing', async () => {
      const query = mockQuery([]);
      const runner = new DiagnosticRunner(query);
      const selectivity: DiagnosticFilterSelectivity = {};
      await runner.evaluateFilterSelectivity(selectivity);
      expect(query).not.toHaveBeenCalled();
    });

    it('sets warning when filter ratio below threshold', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 1000 }])
        .mockResolvedValueOnce([{ row_count: 80 }]);
      const runner = new DiagnosticRunner(query);
      const selectivity: DiagnosticFilterSelectivity = {
        unfilteredCountSql: 'SELECT COUNT(*) FROM t',
        filteredCountSql: "SELECT COUNT(*) FROM t WHERE region = 'East'",
        threshold: 0.1,
      };
      await runner.evaluateFilterSelectivity(selectivity);
      expect(selectivity.unfilteredCount).toBe(1000);
      expect(selectivity.filteredCount).toBe(80);
      expect(selectivity.ratio).toBe(0.08);
      expect(selectivity.warning).toContain('8.0%');
      expect(selectivity.warning).toContain('80');
      expect(selectivity.warning).toContain('1,000');
    });

    it('does not warn when ratio above threshold', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 1000 }])
        .mockResolvedValueOnce([{ row_count: 300 }]);
      const runner = new DiagnosticRunner(query);
      const selectivity: DiagnosticFilterSelectivity = {
        unfilteredCountSql: 'SELECT COUNT(*) FROM t',
        filteredCountSql: "SELECT COUNT(*) FROM t WHERE region = 'East'",
        threshold: 0.1,
      };
      await runner.evaluateFilterSelectivity(selectivity);
      expect(selectivity.ratio).toBe(0.3);
      expect(selectivity.warning).toBeUndefined();
    });

    it('captures query error', async () => {
      const query = vi.fn().mockRejectedValueOnce(new Error('DB error'));
      const runner = new DiagnosticRunner(query);
      const selectivity: DiagnosticFilterSelectivity = {
        unfilteredCountSql: 'SELECT COUNT(*) FROM t',
        filteredCountSql: 'SELECT COUNT(*) FROM t WHERE 1=0',
        threshold: 0.1,
      };
      await runner.evaluateFilterSelectivity(selectivity);
      expect(selectivity.error).toContain('DB error');
    });
  });

  describe('evaluateDateParse', () => {
    it('skips evaluation when SQL is missing', async () => {
      const query = mockQuery([]);
      const runner = new DiagnosticRunner(query);
      const dateParse: DiagnosticDateParse = {};
      await runner.evaluateDateParse(dateParse);
      expect(query).not.toHaveBeenCalled();
    });

    it('sets warning when rows are dropped', async () => {
      const query = vi.fn().mockResolvedValueOnce([{ checked_rows: 1000, dropped_rows: 50 }]);
      const runner = new DiagnosticRunner(query);
      const dateParse: DiagnosticDateParse = {
        field: 'Order Date',
        sql: 'SELECT ...',
      };
      await runner.evaluateDateParse(dateParse);
      expect(dateParse.checkedRows).toBe(1000);
      expect(dateParse.droppedRows).toBe(50);
      expect(dateParse.warning).toContain('50');
      expect(dateParse.warning).toContain('Order Date');
    });

    it('does not warn when no rows dropped', async () => {
      const query = vi.fn().mockResolvedValueOnce([{ checked_rows: 1000, dropped_rows: 0 }]);
      const runner = new DiagnosticRunner(query);
      const dateParse: DiagnosticDateParse = {
        field: 'Order Date',
        sql: 'SELECT ...',
      };
      await runner.evaluateDateParse(dateParse);
      expect(dateParse.droppedRows).toBe(0);
      expect(dateParse.warning).toBeUndefined();
    });

    it('captures query error', async () => {
      const query = vi.fn().mockRejectedValueOnce(new Error('Parse error'));
      const runner = new DiagnosticRunner(query);
      const dateParse: DiagnosticDateParse = {
        field: 'Order Date',
        sql: 'SELECT ...',
      };
      await runner.evaluateDateParse(dateParse);
      expect(dateParse.error).toContain('Parse error');
    });
  });

  describe('evaluateDiagnostics', () => {
    it('clones and evaluates all diagnostic types', async () => {
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ row_count: 100 }])
        .mockResolvedValueOnce([{ row_count: 200 }])
        .mockResolvedValueOnce([{ row_count: 1000 }])
        .mockResolvedValueOnce([{ row_count: 50 }])
        .mockResolvedValueOnce([{ checked_rows: 500, dropped_rows: 10 }]);
      const runner = new DiagnosticRunner(query);
      const planned = {
        sql: 'SELECT * FROM t',
        diagnostics: {
          joinFanout: {
            baseTable: 't',
            baseCountSql: 'SELECT COUNT(*) FROM t',
            joinedCountSql: 'SELECT COUNT(*) FROM t JOIN ...',
            threshold: 1.5,
            minExtraRows: 10,
          },
          filterSelectivity: {
            unfilteredCountSql: 'SELECT COUNT(*) FROM t',
            filteredCountSql: "SELECT COUNT(*) FROM t WHERE x = 'a'",
            threshold: 0.01,
          },
          dateParse: {
            field: 'Order Date',
            sql: 'SELECT ...',
          },
        },
      };
      const result = await runner.evaluateDiagnostics(planned.diagnostics!);
      expect(result.joinFanout!.baseCount).toBe(100);
      expect(result.joinFanout!.joinedCount).toBe(200);
      expect(result.filterSelectivity!.unfilteredCount).toBe(1000);
      expect(result.dateParse!.checkedRows).toBe(500);
    });
  });
});
