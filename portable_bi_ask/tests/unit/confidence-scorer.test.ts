import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfidenceScorer } from '../../src/result-analysis.ts';
import type { AskIntent, CatalogField } from '../../src/types.ts';

const salesField = (): CatalogField => ({
  id: 'sales::Sales',
  table: 'sales',
  column: 'Sales',
  role: 'measure',
  label: 'Sales',
  labels: {},
  synonyms: ['revenue'],
  localizedSynonyms: {},
  description: '',
  default: true,
  priority: 20,
  sampleValues: [],
  samples: [],
  dateProfile: null,
  cardinality: 0,
  rowCount: 100,
  aggregation: 'SUM',
  type: 'DOUBLE',
});

const regionField = (): CatalogField => ({
  id: 'customer::Region',
  table: 'customer',
  column: 'Region',
  role: 'dimension',
  label: 'Region',
  labels: {},
  synonyms: [],
  localizedSynonyms: {},
  description: '',
  default: false,
  priority: 10,
  sampleValues: [],
  samples: [],
  dateProfile: null,
  cardinality: 4,
  rowCount: 100,
  type: 'VARCHAR',
});

const baseIntent = (overrides: Partial<AskIntent> = {}): AskIntent => ({
  question: 'sales by region',
  analysisType: 'kpi',
  metric: salesField(),
  dimensions: [regionField()],
  filters: [],
  ...overrides,
});

function makeScorer() {
  const displayLabel = vi.fn((f: Partial<CatalogField>) => f.label ?? '');
  const localizedTerms = vi.fn(() => [] as string[]);
  const buildJoinPlan = vi.fn(() => ({ joins: [] }));
  const patternFromTerm = vi.fn((term: string) => new RegExp(`\\b${term}\\b`, 'i'));

  const scorer = new ConfidenceScorer({
    config: { dataSources: [{ name: 'sales' }] },
    termMatcher: { patternFromTerm },
    displayLabel,
    localizedTerms,
    buildJoinPlan,
  });
  return { scorer, displayLabel, localizedTerms, buildJoinPlan, patternFromTerm };
}

describe('ConfidenceScorer', () => {
  describe('exact term match', () => {
    it('returns high score when question contains the field label exactly', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(baseIntent({ question: 'sales by region' }));
      expect(score).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('join plan confidence', () => {
    it('reduces score when join plan returns an error', () => {
      const { scorer, buildJoinPlan } = makeScorer();
      buildJoinPlan.mockReturnValue({ error: 'No path found' });
      const score = scorer.estimate(baseIntent());
      expect(score).toBeLessThan(0.6);
    });

    it('calls buildJoinPlan with the metric table as base', () => {
      const { scorer, buildJoinPlan } = makeScorer();
      scorer.estimate(baseIntent());
      expect(buildJoinPlan).toHaveBeenCalledWith(
        'sales',
        expect.arrayContaining(['sales', 'customer']),
      );
    });
  });

  describe('dependency call tracking', () => {
    it('calls displayLabel for each field being scored', () => {
      const { scorer, displayLabel } = makeScorer();
      scorer.estimate(baseIntent());
      expect(displayLabel.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls localizedTerms for each field', () => {
      const { scorer, localizedTerms } = makeScorer();
      scorer.estimate(baseIntent());
      expect(localizedTerms.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls patternFromTerm to check for field label in the question', () => {
      const { scorer, patternFromTerm } = makeScorer();
      scorer.estimate(baseIntent());
      expect(patternFromTerm).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('returns a finite number between 0 and 1 for any well-formed intent', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(baseIntent({ question: 'something completely unrelated xyz' }));
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
