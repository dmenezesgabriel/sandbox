import { describe, expect, it } from 'vitest';

import type { AskIntent, CatalogField, DataRow, ResultShape } from '../../../shared/types/index';
import { ResultAnalyzer } from './result-analyzer';

// --- Helpers ---

const noShape = (): ResultShape => ({
  columns: [],
  rowCount: 0,
  numeric: [],
  categoric: [],
  time: [],
  numericCount: 0,
  categoricCount: 0,
  timeCount: 0,
  seriesCount: 1,
  groupCount: 0,
  hasMetric: false,
  oneObservationPerGroup: true,
});

const noIntent = (overrides: Partial<AskIntent> = {}): AskIntent => ({
  question: '',
  analysisType: 'kpi',
  metric: null,
  dimensions: [],
  filters: [],
  ...overrides,
});

const timeField: CatalogField = {
  id: 'sales::date',
  table: 'sales',
  column: 'date',
  role: 'time',
  type: 'VARCHAR',
  label: 'Date',
  labels: {},
  synonyms: [],
  localizedSynonyms: {},
  description: '',
  default: false,
  priority: 0,
  sampleValues: [],
  samples: [],
  dateProfile: null,
  cardinality: 0,
  rowCount: 0,
};

const rows = (...entries: [string, number][]): DataRow[] =>
  entries.map(([label, value]) => ({ label, value }));

// ───────────────────────────────────────────────
// ResultAnalyzer
// ───────────────────────────────────────────────

describe('ResultAnalyzer', () => {
  const analyzer = new ResultAnalyzer();

  describe('valid rows', () => {
    it('excludes non-finite values', () => {
      const facts = analyzer.analyze(
        [
          { label: 'A', value: 10 },
          { label: 'B', value: 'nan' },
          { label: 'C', value: null },
        ],
        noIntent(),
        noShape(),
      );
      expect(facts.valid).toHaveLength(1);
      expect(facts.valid[0].label).toBe('A');
    });

    it('returns empty valid for empty rows', () => {
      const facts = analyzer.analyze([], noIntent(), noShape());
      expect(facts.valid).toHaveLength(0);
    });
  });

  describe('total', () => {
    it('sums all valid numeric values', () => {
      const facts = analyzer.analyze(
        rows(['A', 100], ['B', 200], ['C', 300]),
        noIntent(),
        noShape(),
      );
      expect(facts.total).toBe(600);
    });

    it('returns 0 for empty valid rows', () => {
      const facts = analyzer.analyze([], noIntent(), noShape());
      expect(facts.total).toBe(0);
    });
  });

  describe('sorted', () => {
    it('sorts valid rows descending by value', () => {
      const facts = analyzer.analyze(
        rows(['A', 100], ['B', 500], ['C', 200]),
        noIntent(),
        noShape(),
      );
      expect(facts.sorted.map((r) => r.label)).toEqual(['B', 'C', 'A']);
    });

    it('does not mutate the original rows order', () => {
      const input = rows(['A', 100], ['B', 500], ['C', 200]);
      analyzer.analyze(input, noIntent(), noShape());
      expect(input.map((r) => r.label)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('top and bottom', () => {
    it('top is the row with the highest value', () => {
      const facts = analyzer.analyze(
        rows(['Low', 10], ['High', 90], ['Mid', 50]),
        noIntent(),
        noShape(),
      );
      expect(facts.top?.label).toBe('High');
    });

    it('bottom is the row with the lowest value', () => {
      const facts = analyzer.analyze(
        rows(['Low', 10], ['High', 90], ['Mid', 50]),
        noIntent(),
        noShape(),
      );
      expect(facts.bottom?.label).toBe('Low');
    });

    it('top and bottom are undefined when no valid rows', () => {
      const facts = analyzer.analyze([], noIntent(), noShape());
      expect(facts.top).toBeUndefined();
      expect(facts.bottom).toBeUndefined();
    });

    it('top and bottom are the same row when only one valid row', () => {
      const facts = analyzer.analyze(rows(['Only', 42]), noIntent(), noShape());
      expect(facts.top?.label).toBe('Only');
      expect(facts.bottom?.label).toBe('Only');
    });
  });

  describe('topNShare', () => {
    it('returns share of top 3 rows when 3+ rows exist', () => {
      const facts = analyzer.analyze(
        rows(['A', 500], ['B', 300], ['C', 200], ['D', 100]),
        noIntent(),
        noShape(),
      );
      // top 3: A=500, B=300, C=200 → 1000/1100
      expect(facts.topNShare).toBeCloseTo(1000 / 1100, 5);
    });

    it('returns null when fewer than 3 valid rows', () => {
      const facts = analyzer.analyze(rows(['A', 100], ['B', 200]), noIntent(), noShape());
      expect(facts.topNShare).toBeNull();
    });

    it('returns null when total is 0', () => {
      const facts = analyzer.analyze(rows(['A', 0], ['B', 0], ['C', 0]), noIntent(), noShape());
      expect(facts.topNShare).toBeNull();
    });
  });

  describe('mean and stdDev', () => {
    it('computes correct mean', () => {
      const facts = analyzer.analyze(rows(['A', 10], ['B', 20], ['C', 30]), noIntent(), noShape());
      expect(facts.mean).toBe(20);
    });

    it('returns 0 mean for empty valid rows', () => {
      const facts = analyzer.analyze([], noIntent(), noShape());
      expect(facts.mean).toBe(0);
    });

    it('computes correct stdDev for uniform values', () => {
      const facts = analyzer.analyze(rows(['A', 5], ['B', 5], ['C', 5]), noIntent(), noShape());
      expect(facts.stdDev).toBe(0);
    });

    it('computes correct stdDev for known values', () => {
      // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, variance=4, stdDev=2
      const r = rows(
        ['A', 2],
        ['B', 4],
        ['C', 4],
        ['D', 4],
        ['E', 5],
        ['F', 5],
        ['G', 7],
        ['H', 9],
      );
      const facts = analyzer.analyze(r, noIntent(), noShape());
      expect(facts.mean).toBe(5);
      expect(facts.stdDev).toBeCloseTo(2, 5);
    });
  });

  describe('isTimeSeries', () => {
    it('is true when intent has a time dimension', () => {
      const facts = analyzer.analyze(
        rows(['Jan', 100]),
        noIntent({ dimensions: [timeField] }),
        noShape(),
      );
      expect(facts.isTimeSeries).toBe(true);
    });

    it('is true when analysisType is trend', () => {
      const facts = analyzer.analyze(
        rows(['Jan', 100]),
        noIntent({ analysisType: 'trend' }),
        noShape(),
      );
      expect(facts.isTimeSeries).toBe(true);
    });

    it('is true when shape has timeCount > 0', () => {
      const facts = analyzer.analyze(rows(['Jan', 100]), noIntent(), {
        ...noShape(),
        timeCount: 1,
      });
      expect(facts.isTimeSeries).toBe(true);
    });

    it('is false when no time signals', () => {
      const facts = analyzer.analyze(rows(['A', 100]), noIntent(), noShape());
      expect(facts.isTimeSeries).toBe(false);
    });
  });

  describe('trendChange and trendPct', () => {
    it('computes change from first to last row for a time series', () => {
      const intent = noIntent({ dimensions: [timeField] });
      const facts = analyzer.analyze(
        rows(['Jan', 100], ['Feb', 150], ['Mar', 200]),
        intent,
        noShape(),
      );
      expect(facts.trendChange).toBe(100);
      expect(facts.trendPct).toBeCloseTo(1.0, 5);
    });

    it('computes negative trendChange for declining series', () => {
      const intent = noIntent({ dimensions: [timeField] });
      const facts = analyzer.analyze(
        rows(['Jan', 200], ['Feb', 150], ['Mar', 100]),
        intent,
        noShape(),
      );
      expect(facts.trendChange).toBe(-100);
      expect(facts.trendPct).toBeCloseTo(-0.5, 5);
    });

    it('returns null trendPct when first value is 0', () => {
      const intent = noIntent({ dimensions: [timeField] });
      const facts = analyzer.analyze(rows(['Jan', 0], ['Feb', 100]), intent, noShape());
      expect(facts.trendChange).toBe(100);
      expect(facts.trendPct).toBeNull();
    });

    it('returns null trendChange for non-time series', () => {
      const facts = analyzer.analyze(rows(['A', 100], ['B', 200]), noIntent(), noShape());
      expect(facts.trendChange).toBeNull();
      expect(facts.trendPct).toBeNull();
    });

    it('returns null trendChange when fewer than 2 valid rows in a time series', () => {
      const facts = analyzer.analyze(
        rows(['Jan', 100]),
        noIntent({ dimensions: [timeField] }),
        noShape(),
      );
      expect(facts.trendChange).toBeNull();
    });
  });
});
