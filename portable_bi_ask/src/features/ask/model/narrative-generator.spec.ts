import { describe, expect, it } from 'vitest';

import type { AskIntent, CatalogField, DataRow, ResultShape } from '../../../shared/types/index';
import { NarrativeGenerator } from './narrative-generator';

// --- Helpers ---

const noShape = (overrides: Partial<ResultShape> = {}): ResultShape => ({
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
  ...overrides,
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

const dimField: CatalogField = {
  ...timeField,
  id: 'customer::Region',
  column: 'Region',
  role: 'dimension',
  label: 'Region',
};

const measureField: CatalogField = {
  ...timeField,
  id: 'sales::Sales',
  column: 'Sales',
  role: 'measure',
  label: 'Sales',
  type: 'DOUBLE',
};

const rows = (...entries: [string, number][]): DataRow[] =>
  entries.map(([label, value]) => ({ label, value }));

// ───────────────────────────────────────────────
// NarrativeGenerator
// ───────────────────────────────────────────────

describe('NarrativeGenerator', () => {
  const gen = new NarrativeGenerator();

  describe('generateNarratives()', () => {
    describe('empty data', () => {
      it('returns empty narratives with a "no data" summary when rows is empty', () => {
        const result = gen.generateNarratives([], noIntent(), noShape());
        expect(result.narratives).toHaveLength(0);
        expect(result.summary).toContain('No data');
        expect(result.keyTakeaway).toContain('Unable to provide');
      });

      it('returns empty narratives when rows is null', () => {
        const result = gen.generateNarratives(null as unknown as DataRow[], noIntent(), noShape());
        expect(result.narratives).toHaveLength(0);
      });
    });

    describe('time series analysis', () => {
      it('produces trend narratives for a time-dimension query', () => {
        const intent = noIntent({ dimensions: [timeField] });
        const shape = noShape({ timeCount: 1, numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Jan', 100], ['Feb', 110], ['Mar', 130], ['Apr', 150]),
          intent,
          shape,
        );
        const types = result.narratives.map((n) => n.type);
        expect(types).toContain('trend');
      });

      it('captures overall trend direction in narratives', () => {
        const intent = noIntent({ dimensions: [timeField] });
        const shape = noShape({ timeCount: 1, numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Jan', 200], ['Feb', 150], ['Mar', 100]),
          intent,
          shape,
        );
        const trendNarrative = result.narratives.find((n) => n.title === 'Overall decrease');
        expect(trendNarrative).toBeDefined();
        expect(trendNarrative?.text).toContain('decrease');
      });

      it('identifies consistent upward movement when all changes are positive', () => {
        const intent = noIntent({ dimensions: [timeField] });
        const shape = noShape({ timeCount: 1, numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Jan', 100], ['Feb', 200], ['Mar', 400], ['Apr', 800]),
          intent,
          shape,
        );
        const consistent = result.narratives.find((n) => n.title?.includes('Consistent'));
        expect(consistent).toBeDefined();
        expect(consistent?.type).toBe('trend');
        expect(consistent?.importance).toBeGreaterThanOrEqual(9);
      });

      it('reports accelerating when recent values are higher than early values', () => {
        // firstThird avg ≈ 11, lastThird avg ≈ 130 → recentTrend must be positive → accelerating
        const intent = noIntent({ dimensions: [timeField] });
        const shape = noShape({ timeCount: 1, numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Jan', 10], ['Feb', 12], ['Mar', 14], ['Apr', 100], ['May', 120], ['Jun', 140]),
          intent,
          shape,
        );
        const recentTrend = result.narratives.find((n) => n.title?.startsWith('Recent trend'));
        expect(recentTrend).toBeDefined();
        expect(recentTrend?.title).toContain('accelerating');
      });

      it('reports decelerating when recent values are lower than early values', () => {
        // firstThird avg ≈ 130, lastThird avg ≈ 11 → recentTrend must be negative → decelerating
        const intent = noIntent({ dimensions: [timeField] });
        const shape = noShape({ timeCount: 1, numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Jan', 140], ['Feb', 120], ['Mar', 100], ['Apr', 14], ['May', 12], ['Jun', 10]),
          intent,
          shape,
        );
        const recentTrend = result.narratives.find((n) => n.title?.startsWith('Recent trend'));
        expect(recentTrend).toBeDefined();
        expect(recentTrend?.title).toContain('decelerating');
      });
    });

    describe('distribution analysis', () => {
      it('detects concentrated distribution when top 3 hold > 60%', () => {
        const shape = noShape({ categoricCount: 1, numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['A', 600], ['B', 200], ['C', 100], ['D', 50], ['E', 50]),
          noIntent({ dimensions: [dimField] }),
          shape,
        );
        const dist = result.narratives.find((n) => n.title === 'Concentrated distribution');
        expect(dist).toBeDefined();
        expect(dist?.type).toBe('distribution');
      });

      it('detects long tail when many groups have < 5% share', () => {
        const shape = noShape({ categoricCount: 1, numericCount: 1 });
        const manySmall = Array.from({ length: 10 }, (_, i) => [`G${i}`, 1] as [string, number]);
        // Use a high cap so the long tail narrative isn't displaced by higher-priority ones
        const unlimitedGen = new NarrativeGenerator({ maxNarratives: 20 });
        const result = unlimitedGen.generateNarratives(
          [...rows(['Big', 1000]), ...rows(...manySmall)],
          noIntent({ dimensions: [dimField] }),
          shape,
        );
        const longTail = result.narratives.find((n) => n.title === 'Long tail pattern');
        expect(longTail).toBeDefined();
      });
    });

    describe('outlier detection', () => {
      it('detects high outliers using std-dev threshold', () => {
        const shape = noShape({ numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['A', 10], ['B', 10], ['C', 10], ['D', 10], ['E', 100]),
          noIntent(),
          shape,
        );
        const outlier = result.narratives.find((n) => n.type === 'outlier');
        expect(outlier).toBeDefined();
        expect(outlier?.title).toContain('High');
      });

      it('does not fire outlier detection for fewer than 4 rows', () => {
        const shape = noShape({ numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['A', 10], ['B', 10], ['C', 100]),
          noIntent(),
          shape,
        );
        const outlier = result.narratives.find((n) => n.type === 'outlier');
        expect(outlier).toBeUndefined();
      });

      it('does not fire when all values are equal (stdDev === 0)', () => {
        const shape = noShape({ numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['A', 10], ['B', 10], ['C', 10], ['D', 10]),
          noIntent(),
          shape,
        );
        const outlier = result.narratives.find((n) => n.type === 'outlier');
        expect(outlier).toBeUndefined();
      });
    });

    describe('extremes analysis', () => {
      it('produces a highest-performer narrative for non-empty numeric data', () => {
        const shape = noShape({ numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Alpha', 500], ['Beta', 100], ['Gamma', 200]),
          noIntent(),
          shape,
        );
        const top = result.narratives.find((n) => n.title === 'Highest performer');
        expect(top).toBeDefined();
        expect(top?.text).toContain('Alpha');
      });

      it('produces a lowest-performer narrative when 3+ rows exist', () => {
        const shape = noShape({ numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Alpha', 500], ['Beta', 100], ['Gamma', 200]),
          noIntent(),
          shape,
          measureField,
        );
        const bottom = result.narratives.find((n) => n.title === 'Lowest performer');
        expect(bottom).toBeDefined();
        expect(bottom?.text).toContain('Beta');
      });

      it('adds market leader dominance when top holds > 40%', () => {
        const shape = noShape({ numericCount: 1 });
        const result = gen.generateNarratives(
          rows(['Leader', 700], ['Second', 200], ['Third', 100]),
          noIntent(),
          shape,
        );
        const dominance = result.narratives.find((n) => n.title === 'Market leader dominance');
        expect(dominance).toBeDefined();
      });
    });

    describe('summary and keyTakeaway', () => {
      it('returns a non-empty summary string', () => {
        const result = gen.generateNarratives(
          rows(['A', 100], ['B', 200]),
          noIntent(),
          noShape({ numericCount: 1 }),
        );
        expect(typeof result.summary).toBe('string');
        expect(result.summary.length).toBeGreaterThan(0);
      });

      it('returns a non-empty keyTakeaway', () => {
        const result = gen.generateNarratives(
          rows(['A', 100], ['B', 200]),
          noIntent(),
          noShape({ numericCount: 1 }),
        );
        expect(typeof result.keyTakeaway).toBe('string');
        expect(result.keyTakeaway.length).toBeGreaterThan(0);
      });

      it('returns a fallback summary when no narratives are generated', () => {
        const result = gen.generateNarratives(
          rows(['A', 100]),
          noIntent(),
          noShape({ numericCount: 1 }),
        );
        expect(result.summary.length).toBeGreaterThan(0);
      });
    });

    describe('narrative count respects maxNarratives config', () => {
      it('limits output to maxNarratives', () => {
        const limitedGen = new NarrativeGenerator({ maxNarratives: 2 });
        const shape = noShape({ numericCount: 1, categoricCount: 1 });
        const result = limitedGen.generateNarratives(
          rows(['A', 600], ['B', 100], ['C', 50], ['D', 20], ['E', 10]),
          noIntent({ dimensions: [dimField] }),
          shape,
        );
        expect(result.narratives.length).toBeLessThanOrEqual(2);
      });
    });
  });
});
