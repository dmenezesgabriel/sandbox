import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AskIntent,
  CatalogField,
  DataRow,
  Diagnostics,
  JoinPlanProvider,
  Relationship,
  ResultShape,
} from '../../../shared/types/index';
import {
  ChartDecisionTree,
  ConfidenceScorer,
  InsightGenerator,
  ResultShapeAnalyzer,
  ResultValidator,
} from './result-analysis';

// --- Helpers ---

const shape = (overrides: Partial<ResultShape>): ResultShape => ({
  columns: [],
  rowCount: 10,
  numeric: [],
  categoric: [],
  time: [],
  numericCount: 0,
  categoricCount: 0,
  timeCount: 0,
  seriesCount: 1,
  groupCount: 10,
  hasMetric: false,
  oneObservationPerGroup: true,
  ...overrides,
});

const makeIntent = (overrides: Partial<AskIntent>): AskIntent => ({
  question: '',
  analysisType: 'kpi',
  metric: null,
  dimensions: [],
  filters: [],
  ...overrides,
});

function baseIntent(overrides: Partial<AskIntent> = {}): AskIntent {
  return {
    question: 'sales by region',
    analysisType: 'kpi',
    metric: measureField,
    dimensions: [dimField],
    filters: [],
    ...overrides,
  };
}

const timeField: CatalogField = {
  id: 'sales::Order Date',
  table: 'sales',
  column: 'Order Date',
  role: 'time',
  type: 'VARCHAR',
  label: 'Order Date',
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
};

// ───────────────────────────────────────────────
// ChartDecisionTree
// ───────────────────────────────────────────────

describe('ChartDecisionTree', () => {
  let tree: ChartDecisionTree;

  beforeEach(() => {
    tree = new ChartDecisionTree();
  });

  it('returns table for list_values analysis', () => {
    const result = tree.decide(
      shape({}),
      makeIntent({ analysisType: 'list_values', dimensions: [dimField] }),
    );
    expect(result.rendered).toBe('table');
  });

  it('returns table for yoy analysis', () => {
    const result = tree.decide(shape({}), makeIntent({ analysisType: 'yoy' }));
    expect(result.rendered).toBe('table');
  });

  it('returns table for change analysis', () => {
    const result = tree.decide(shape({}), makeIntent({ analysisType: 'change' }));
    expect(result.rendered).toBe('table');
  });

  it('returns bar for share analysis', () => {
    const result = tree.decide(
      shape({ numericCount: 2, categoricCount: 1 }),
      makeIntent({ analysisType: 'share', dimensions: [dimField] }),
    );
    expect(result.rendered).toBe('bar');
  });

  it('returns kpi for single aggregate with no dimension', () => {
    const result = tree.decide(
      shape({ numericCount: 1, categoricCount: 0, rowCount: 1, groupCount: 1 }),
      makeIntent({ dimensions: [] }),
    );
    expect(result.rendered).toBe('kpi');
  });

  it('returns line for a time-dimension query', () => {
    const result = tree.decide(
      shape({ numericCount: 1, categoricCount: 0, timeCount: 1, seriesCount: 1 }),
      makeIntent({ dimensions: [timeField] }),
    );
    expect(result.rendered).toBe('line');
  });

  it('returns bar for a categorical dimension with one numeric', () => {
    const result = tree.decide(
      shape({ numericCount: 1, categoricCount: 1, rowCount: 10, groupCount: 10 }),
      makeIntent({ dimensions: [dimField] }),
    );
    expect(result.rendered).toBe('bar');
  });

  it('falls back to table when recommended chart is disabled', () => {
    const noKpi = new ChartDecisionTree({ kpi: false });
    const result = noKpi.decide(
      shape({ numericCount: 1, rowCount: 1, groupCount: 1 }),
      makeIntent({ dimensions: [] }),
    );
    expect(result.rendered).toBe('table');
  });

  it('includes the decision path in the result', () => {
    const result = tree.decide(
      shape({}),
      makeIntent({ analysisType: 'list_values', dimensions: [dimField] }),
    );
    expect(result.path.length).toBeGreaterThan(0);
    expect(typeof result.reason).toBe('string');
  });

  it('returns table when there are two numerics with many rows', () => {
    const result = tree.decide(
      shape({ numericCount: 2, categoricCount: 0, rowCount: 3000 }),
      makeIntent({}),
    );
    expect(result.rendered).toBe('table');
  });

  it('returns table for two numerics since scatter is not a default capability', () => {
    const result = tree.decide(
      shape({ numericCount: 2, categoricCount: 0, rowCount: 100 }),
      makeIntent({}),
    );
    expect(result.rendered).toBe('table');
    expect(result.recommended).toBe('scatter');
  });

  it('returns table when time series has more than 7 series', () => {
    const result = tree.decide(
      shape({ numericCount: 1, categoricCount: 0, timeCount: 1, seriesCount: 10 }),
      makeIntent({ dimensions: [timeField] }),
    );
    expect(result.rendered).toBe('table');
  });

  it('returns pie when rowCount <= 5 and pie is enabled', () => {
    const result = tree.decide(
      shape({ numericCount: 1, categoricCount: 1, rowCount: 4 }),
      makeIntent({ dimensions: [dimField] }),
    );
    expect(result.rendered).toBe('pie');
  });
});

// ───────────────────────────────────────────────
// ConfidenceScorer
// ───────────────────────────────────────────────

describe('ConfidenceScorer', () => {
  function makeScorer() {
    const displayLabel = vi.fn((f: Partial<CatalogField>) => f.label ?? '');
    const localizedTerms = vi.fn(() => [] as string[]);
    const buildJoinPlan = vi.fn(
      (
        _baseTable: string,
        _neededTables: string[],
      ): { error?: string; joins?: Relationship[] } => ({
        joins: [],
      }),
    );
    const patternFromTerm = vi.fn((term: string) => new RegExp(`\\b${term}\\b`, 'i'));

    const scorer = new ConfidenceScorer({
      config: { dataSources: [{ name: 'sales' }] },
      termMatcher: { patternFromTerm },
      displayLabel,
      localizedTerms,
      joinPlanProvider: { buildJoinPlan },
    });
    return { scorer, displayLabel, localizedTerms, buildJoinPlan, patternFromTerm };
  }

  it('returns high score when question contains the field label exactly', () => {
    const { scorer } = makeScorer();
    const score = scorer.estimate(baseIntent({ question: 'sales by region' }));
    expect(score).toBeGreaterThanOrEqual(0.9);
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
      expect(buildJoinPlan).toHaveBeenCalledTimes(1);
      expect(buildJoinPlan).toHaveBeenCalledWith('sales', expect.arrayContaining(['sales']));
    });
  });

  describe('JoinPlanProvider port', () => {
    it('accepts a JoinPlanProvider object and returns a finite score', () => {
      const provider: JoinPlanProvider = { buildJoinPlan: vi.fn(() => ({ joins: [] })) };
      const scorer = new ConfidenceScorer({
        config: { dataSources: [{ name: 'sales' }] },
        termMatcher: { patternFromTerm: vi.fn(() => null) },
        displayLabel: vi.fn((f) => (f as Partial<CatalogField>).label ?? ''),
        localizedTerms: vi.fn(() => [] as string[]),
        joinPlanProvider: provider,
      });
      const score = scorer.estimate(baseIntent());
      expect(Number.isFinite(score)).toBe(true);
    });

    it('delegates to joinPlanProvider.buildJoinPlan with the metric table as base', () => {
      const buildJoinPlan = vi.fn(() => ({ joins: [] }));
      const provider: JoinPlanProvider = { buildJoinPlan };
      const scorer = new ConfidenceScorer({
        config: { dataSources: [{ name: 'sales' }] },
        termMatcher: { patternFromTerm: vi.fn(() => null) },
        displayLabel: vi.fn((f) => (f as Partial<CatalogField>).label ?? ''),
        localizedTerms: vi.fn(() => [] as string[]),
        joinPlanProvider: provider,
      });
      scorer.estimate(baseIntent());
      expect(buildJoinPlan).toHaveBeenCalledTimes(1);
      expect(buildJoinPlan).toHaveBeenCalledWith('sales', expect.arrayContaining(['sales']));
    });

    it('reduces score when joinPlanProvider.buildJoinPlan returns an error', () => {
      const provider: JoinPlanProvider = {
        buildJoinPlan: vi.fn(() => ({ error: 'No path found' })),
      };
      const scorer = new ConfidenceScorer({
        config: { dataSources: [{ name: 'sales' }] },
        termMatcher: { patternFromTerm: vi.fn(() => null) },
        displayLabel: vi.fn((f) => (f as Partial<CatalogField>).label ?? ''),
        localizedTerms: vi.fn(() => [] as string[]),
        joinPlanProvider: provider,
      });
      const score = scorer.estimate(baseIntent());
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('dependency call tracking', () => {
    it('calls displayLabel for each field being scored', () => {
      const { scorer, displayLabel } = makeScorer();
      scorer.estimate(baseIntent());
      expect(displayLabel).toHaveBeenCalled();
      expect(displayLabel.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls localizedTerms for each field', () => {
      const { scorer, localizedTerms } = makeScorer();
      scorer.estimate(baseIntent());
      expect(localizedTerms).toHaveBeenCalled();
      expect(localizedTerms.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls patternFromTerm to check for field label in the question', () => {
      const { scorer, patternFromTerm } = makeScorer();
      scorer.estimate(baseIntent());
      expect(patternFromTerm).toHaveBeenCalled();
      expect(patternFromTerm.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls displayLabel with the metric field', () => {
      const { scorer, displayLabel } = makeScorer();
      scorer.estimate(baseIntent());
      expect(displayLabel).toHaveBeenCalledWith(expect.objectContaining({ column: 'Sales' }));
    });

    it('calls displayLabel with each dimension field', () => {
      const { scorer, displayLabel } = makeScorer();
      scorer.estimate(baseIntent());
      expect(displayLabel).toHaveBeenCalledWith(expect.objectContaining({ column: 'Region' }));
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

    it('handles list_values analysis type without metric scoring', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(
        baseIntent({ analysisType: 'list_values', question: 'list regions' }),
      );
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles empty question gracefully', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(baseIntent({ question: '' }));
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles null metric gracefully', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(baseIntent({ metric: null }));
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles empty dimensions', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(baseIntent({ dimensions: [], metric: null }));
      expect(Number.isFinite(score)).toBe(true);
    });

    it('calls buildJoinPlan only once per estimate', () => {
      const { scorer, buildJoinPlan } = makeScorer();
      scorer.estimate(baseIntent());
      expect(buildJoinPlan).toHaveBeenCalledTimes(1);
    });

    it('returns lower score when no field labels match the question', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(baseIntent({ question: 'something completely unrelated xyz' }));
      expect(score).toBeLessThan(0.9);
    });

    it('handles filters with scores', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(
        baseIntent({
          filters: [{ field: dimField, score: 0.9 }],
        }),
      );
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles dateRange in intent', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(
        baseIntent({
          dateRange: {
            field: timeField,
            start: '2024-01-01',
            end: '2024-12-31',
            text: 'this year',
          },
        }),
      );
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles count_star metric kind', () => {
      const { scorer } = makeScorer();
      const score = scorer.estimate(
        baseIntent({
          metric: { kind: 'count_star', label: 'count' },
        }),
      );
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles buildJoinPlan without joins', () => {
      const { scorer, buildJoinPlan } = makeScorer();
      buildJoinPlan.mockReturnValue({ joins: undefined });
      const score = scorer.estimate(baseIntent());
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('handles no data sources configured', () => {
      const { scorer, buildJoinPlan } = makeScorer();
      buildJoinPlan.mockReturnValue({ error: 'No path' });
      const score = scorer.estimate(baseIntent());
      expect(score).toBeLessThan(0.5);
    });
  });
});

// ───────────────────────────────────────────────
// ResultValidator
// ───────────────────────────────────────────────

describe('ResultValidator', () => {
  let validator: ResultValidator;

  beforeEach(() => {
    validator = new ResultValidator();
  });

  function noIntent(): AskIntent {
    return { question: '', analysisType: 'kpi', metric: null, dimensions: [], filters: [] };
  }

  function withDim(): AskIntent {
    return {
      ...noIntent(),
      dimensions: [
        {
          id: 'customer::Region',
          table: 'customer',
          column: 'Region',
          role: 'dimension',
          type: 'VARCHAR',
          label: 'Region',
          labels: {},
          synonyms: [],
          localizedSynonyms: {},
          description: '',
          default: false,
          priority: 0,
          sampleValues: [],
          samples: [],
          dateProfile: null,
          cardinality: 4,
          rowCount: 100,
        },
      ],
    };
  }

  describe('empty rows warning', () => {
    it('fires when rows array is empty', () => {
      const warnings = validator.validate({
        rows: [],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('No rows matched'))).toBe(true);
    });

    it('fires when every cell in every row is null', () => {
      const warnings = validator.validate({
        rows: [{ value: null }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('No rows matched'))).toBe(true);
    });

    it('does not fire when rows have real values', () => {
      const warnings = validator.validate({
        rows: [{ label: 'West', value: 100 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('No rows matched'))).toBe(true);
    });

    it('fires when rows is null', () => {
      const warnings = validator.validate({
        rows: null as unknown as DataRow[],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('No rows matched'))).toBe(true);
    });

    it('fires when every value is empty string', () => {
      const warnings = validator.validate({
        rows: [{ value: '' }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('No rows matched'))).toBe(true);
    });
  });

  describe('low confidence warning', () => {
    it('fires when confidence is below 0.8', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.75,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('fuzzy or inferred'))).toBe(true);
    });

    it('does not fire at exactly 0.8', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.8,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('fuzzy or inferred'))).toBe(true);
    });

    it('does not fire above 0.8', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.95,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('fuzzy or inferred'))).toBe(true);
    });
  });

  describe('null or blank grouped label warning', () => {
    it('fires when a grouped row has an empty string label', () => {
      const warnings = validator.validate({
        rows: [
          { label: 'West', value: 100 },
          { label: '', value: 50 },
        ],
        intent: withDim(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('null or blank'))).toBe(true);
    });

    it('does not fire when all labels are non-blank', () => {
      const warnings = validator.validate({
        rows: [{ label: 'West', value: 100 }],
        intent: withDim(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('null or blank'))).toBe(true);
    });

    it('does not fire when there are no dimensions', () => {
      const warnings = validator.validate({
        rows: [{ label: '', value: 100 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('null or blank'))).toBe(true);
    });

    it('fires when label contains " /  / " pattern', () => {
      const warnings = validator.validate({
        rows: [
          { label: 'West', value: 100 },
          { label: 'East /  / North', value: 50 },
        ],
        intent: withDim(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('null or blank'))).toBe(true);
    });

    it('fires when label ends with " / "', () => {
      const warnings = validator.validate({
        rows: [
          { label: 'West', value: 100 },
          { label: 'East / ', value: 50 },
        ],
        intent: withDim(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('null or blank'))).toBe(true);
    });
  });

  describe('diagnostic warnings are propagated', () => {
    it('propagates joinFanout.warning', () => {
      const diagnostics: Diagnostics = {
        joinFanout: { warning: 'Joined row count is 3.0x the base row count.' },
      };
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics,
      });
      expect(warnings.some((w) => w.includes('Joined row count'))).toBe(true);
    });

    it('propagates dateParse.warning', () => {
      const diagnostics: Diagnostics = {
        dateParse: { warning: 'Date parsing dropped 15 Order Date rows.' },
      };
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics,
      });
      expect(warnings.some((w) => w.includes('Date parsing dropped'))).toBe(true);
    });

    it('propagates filterSelectivity.warning', () => {
      const diagnostics: Diagnostics = {
        filterSelectivity: { warning: 'Filters keep only 2.5% of rows.' },
      };
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics,
      });
      expect(warnings.some((w) => w.includes('2.5%'))).toBe(true);
    });

    it('emits no diagnostic warnings when diagnostics is null', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      const diagWarnings = warnings.filter(
        (w) => w.includes('Joined') || w.includes('Date parsing') || w.includes('Filters keep'),
      );
      expect(diagWarnings).toHaveLength(0);
    });

    it('handles partial diagnostics with only joinFanout', () => {
      const diagnostics: Diagnostics = { joinFanout: { warning: 'Fanout detected.' } };
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics,
      });
      expect(warnings.some((w) => w.includes('Fanout detected'))).toBe(true);
    });

    it('propagates all diagnostics together', () => {
      const diagnostics: Diagnostics = {
        joinFanout: { warning: 'Fanout.' },
        dateParse: { warning: 'Parse issues.' },
        filterSelectivity: { warning: 'Selectivity issues.' },
      };
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: noIntent(),
        confidence: 0.97,
        diagnostics,
      });
      expect(
        warnings.filter(
          (w) => w.includes('Fanout') || w.includes('Parse') || w.includes('Selectivity'),
        ),
      ).toHaveLength(3);
    });

    it('returns multiple warnings for multiple issues', () => {
      const warnings = validator.validate({
        rows: [],
        intent: noIntent(),
        confidence: 0.5,
        diagnostics: { joinFanout: { warning: 'Fanout.' } },
      });
      expect(warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('limit warning', () => {
    it('fires when rows length equals the limit', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: { ...noIntent(), dimensions: [dimField], limit: 1 },
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('Showing the top'))).toBe(true);
    });

    it('does not fire for trend analysis even with limit', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: { ...noIntent(), dimensions: [dimField], analysisType: 'trend', limit: 1 },
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('Showing the top'))).toBe(true);
    });

    it('does not fire when rows are fewer than limit', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }, { value: 2 }],
        intent: { ...noIntent(), dimensions: [dimField], limit: 10 },
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('Showing the top'))).toBe(true);
    });
  });
});

// ───────────────────────────────────────────────
// ResultShapeAnalyzer
// ───────────────────────────────────────────────

describe('ResultShapeAnalyzer', () => {
  const analyzer = new ResultShapeAnalyzer();

  function baseIntent(): AskIntent {
    return { question: '', analysisType: 'kpi', metric: null, dimensions: [], filters: [] };
  }

  function timeIntent(): AskIntent {
    return {
      ...baseIntent(),
      dimensions: [
        {
          id: 'sales::Order Date',
          table: 'sales',
          column: 'Order Date',
          role: 'time',
          type: 'VARCHAR',
          label: 'Order Date',
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
        },
      ],
    };
  }

  it('classifies a numeric column correctly', () => {
    const result = analyzer.analyze([{ value: 100 }, { value: 200 }], ['value'], baseIntent());
    expect(result.numeric).toEqual(['value']);
    expect(result.categoric).toEqual([]);
    expect(result.time).toEqual([]);
    expect(result.numericCount).toBe(1);
    expect(result.hasMetric).toBe(true);
  });

  it('classifies a non-numeric column as categoric', () => {
    const result = analyzer.analyze(
      [{ label: 'West' }, { label: 'East' }],
      ['label'],
      baseIntent(),
    );
    expect(result.categoric).toEqual(['label']);
    expect(result.numeric).toEqual([]);
    expect(result.time).toEqual([]);
    expect(result.categoricCount).toBe(1);
    expect(result.hasMetric).toBe(false);
  });

  it('classifies the label column as time when intent has a time dimension', () => {
    const result = analyzer.analyze(
      [{ label: '2017-01-01', value: 100 }],
      ['label', 'value'],
      timeIntent(),
    );
    expect(result.time).toEqual(['label']);
    expect(result.numeric).toEqual(['value']);
    expect(result.categoric).toEqual([]);
    expect(result.timeCount).toBe(1);
  });

  it('counts rows and unique groups correctly', () => {
    const rows = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
      { label: 'A', value: 3 },
    ];
    const result = analyzer.analyze(rows, ['label', 'value'], baseIntent());
    expect(result.rowCount).toBe(3);
    expect(result.groupCount).toBe(2);
  });

  it('infers columns from first row when columns parameter is omitted', () => {
    const result = analyzer.analyze([{ label: 'X', value: 42 }], undefined, baseIntent());
    expect(result.columns).toEqual(['label', 'value']);
    expect(result.numeric).toEqual(['value']);
    expect(result.categoric).toEqual(['label']);
  });

  it('classifies period column as time with time dimension', () => {
    const result = analyzer.analyze(
      [{ period: '2024-Q1', value: 100 }],
      ['period', 'value'],
      timeIntent(),
    );
    expect(result.time).toEqual(['period']);
  });

  it('sets oneObservationPerGroup when groupCount equals rowCount', () => {
    const result = analyzer.analyze(
      [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
      ],
      ['label', 'value'],
      baseIntent(),
    );
    expect(result.oneObservationPerGroup).toBe(true);
  });

  it('sets oneObservationPerGroup false when groups have duplicates', () => {
    const result = analyzer.analyze(
      [
        { label: 'A', value: 1 },
        { label: 'A', value: 2 },
      ],
      ['label', 'value'],
      baseIntent(),
    );
    expect(result.oneObservationPerGroup).toBe(false);
  });

  it('handles empty rows gracefully', () => {
    const result = analyzer.analyze([], undefined, baseIntent());
    expect(result.columns).toEqual([]);
    expect(result.numeric).toEqual([]);
    expect(result.categoric).toEqual([]);
    expect(result.time).toEqual([]);
    expect(result.rowCount).toBe(0);
    expect(result.numericCount).toBe(0);
    expect(result.categoricCount).toBe(0);
    expect(result.timeCount).toBe(0);
  });

  it('classifies multiple dimensions and series correctly', () => {
    const rows = [
      { label: 'A / X', value: 1 },
      { label: 'B / Y', value: 2 },
    ];
    const result = analyzer.analyze(rows, ['label', 'value'], {
      ...baseIntent(),
      dimensions: [dimField, dimField],
    });
    expect(result.seriesCount).toBe(2);
  });

  it('classifies all-null values as categoric', () => {
    const result = analyzer.analyze(
      [{ label: null }, { label: undefined }],
      ['label'],
      baseIntent(),
    );
    expect(result.categoric).toEqual(['label']);
    expect(result.numeric).toEqual([]);
    expect(result.hasMetric).toBe(false);
  });
});

// ───────────────────────────────────────────────
// InsightGenerator
// ───────────────────────────────────────────────

describe('InsightGenerator', () => {
  let generator: InsightGenerator;

  beforeEach(() => {
    generator = new InsightGenerator();
  });

  describe('generate()', () => {
    it('returns empty rows message when rows is empty', () => {
      const insights = generator.generate([], baseIntent(), shape({}));
      expect(insights).toEqual(['No rows matched this question.']);
    });

    it('returns empty rows message when rows is nullish', () => {
      const insights = generator.generate(null as unknown as DataRow[], baseIntent(), shape({}));
      expect(insights).toEqual(['No rows matched this question.']);
    });

    it('returns list_values insight for list_values analysis', () => {
      const insights = generator.generate(
        [{ label: 'East' }, { label: 'West' }],
        baseIntent({ analysisType: 'list_values', dimensions: [dimField] }),
        shape({}),
      );
      expect(insights[0]).toContain('Found 2 distinct');
      expect(insights[0]).toContain('Region');
    });

    it('returns change insights for change analysis', () => {
      const insights = generator.generate(
        [{ value: 100, change: 10, change_percent: 0.11, period: '2024' }],
        baseIntent({ analysisType: 'change' }),
        shape({}),
      );
      expect(insights[0]).toContain('increased');
      expect(insights[0]).toContain('10');
    });

    it('returns empty array for change analysis with no row', () => {
      const insights = generator.generate([], baseIntent({ analysisType: 'change' }), shape({}));
      expect(insights).toEqual(['No rows matched this question.']);
    });

    it('returns total insight for kpi with no dimensions and single value', () => {
      const insights = generator.generate(
        [{ value: 5000 }],
        baseIntent({ dimensions: [], metric: { ...measureField, format: 'currency' } }),
        shape({}),
      );
      expect(insights[0]).toContain('Total');
      expect(insights[0]).toContain('$5,000');
    });

    it('returns empty array when no pattern matches', () => {
      const insights = generator.generate(
        [{ label: 'A', other: 1 }],
        baseIntent({ dimensions: [] }),
        shape({
          columns: ['label', 'other'],
          rowCount: 1,
          numericCount: 0,
          categoricCount: 0,
          timeCount: 0,
          numeric: [],
          categoric: [],
          time: [],
          seriesCount: 1,
          groupCount: 1,
          hasMetric: false,
          oneObservationPerGroup: true,
        }),
      );
      expect(insights).toEqual([]);
    });

    it('returns grouped insights for grouped metrics', () => {
      const insights = generator.generate(
        [
          { label: 'East', value: 200 },
          { label: 'West', value: 100 },
        ],
        baseIntent(),
        shape({
          columns: ['label', 'value'],
          rowCount: 2,
          numericCount: 1,
          categoricCount: 1,
          timeCount: 0,
          numeric: ['value'],
          categoric: ['label'],
          time: [],
          seriesCount: 1,
          groupCount: 2,
          hasMetric: true,
          oneObservationPerGroup: true,
        }),
      );
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toContain('East');
    });

    it('returns yoy insights for yoy analysis type', () => {
      const insights = generator.generate(
        [
          { period: '2022', change_percent: 0.05, change: 1000 },
          { period: '2023', change_percent: 0.12, change: 2500 },
        ],
        baseIntent({ analysisType: 'yoy' }),
        shape({}),
      );
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toContain('YoY');
    });

    it('returns total insight when no dimensions with undefined value', () => {
      const insights = generator.generate(
        [{ value: undefined }],
        baseIntent({ dimensions: [], metric: null }),
        shape({}),
      );
      expect(insights).toEqual([]);
    });

    it('returns grouped insight when row has value but no metric', () => {
      const insights = generator.generate(
        [{ label: 'A', value: 100 }],
        baseIntent({ metric: null }),
        shape({
          columns: ['label', 'value'],
          rowCount: 1,
          numericCount: 1,
          categoricCount: 1,
          timeCount: 0,
          numeric: ['value'],
          categoric: ['label'],
          time: [],
          seriesCount: 1,
          groupCount: 1,
          hasMetric: true,
          oneObservationPerGroup: true,
        }),
      );
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('labelForMetric()', () => {
    it('returns metric label when metric has label', () => {
      const label = generator.labelForMetric(baseIntent());
      expect(label).toBe('Sales');
    });
  });

  describe('changeInsights()', () => {
    it('returns empty array when row is missing', () => {
      const insights = generator.changeInsights([], baseIntent());
      expect(insights).toEqual([]);
    });

    it('returns empty when change is not finite', () => {
      const insights = generator.changeInsights(
        [{ value: 'abc', change: 'abc', change_percent: null }],
        baseIntent(),
      );
      expect(insights).toEqual([]);
    });

    it('handles negative change with decrease direction', () => {
      const insights = generator.changeInsights(
        [{ value: 50, change: -30, change_percent: -0.375, period: '2024' }],
        baseIntent({ metric: { ...measureField, format: 'currency' } }),
      );
      expect(insights[0]).toContain('decreased');
      expect(insights[0]).toContain('30');
    });

    it('handles change with zero percent when change_percent is null', () => {
      const insights = generator.changeInsights(
        [{ value: 80, change: 10, change_percent: null, period: '2023' }],
        baseIntent({ metric: { ...measureField, format: 'currency' } }),
      );
      expect(insights[0]).toContain('increased');
      expect(insights[0]).toContain('0.0%');
    });
  });

  describe('yoyInsights()', () => {
    it('returns empty array when no rows have change_percent', () => {
      const insights = generator.yoyInsights([{ value: 100 }]);
      expect(insights).toEqual([]);
    });

    it('includes latest YoY change and strongest growth', () => {
      const rows = [
        { period: '2022-01', change_percent: 0.05, change: 1000 },
        { period: '2023-01', change_percent: 0.12, change: 2500 },
        { period: '2024-01', change_percent: 0.08, change: 1800 },
      ];
      const insights = generator.yoyInsights(rows);
      expect(insights.length).toBe(2);
      expect(insights[0]).toContain('Latest YoY');
      expect(insights[1]).toContain('Strongest');
      expect(insights[1]).toContain('2023');
    });
  });

  describe('groupedMetricInsights()', () => {
    it('returns empty array when no valid numeric rows', () => {
      const insights = generator.groupedMetricInsights(
        [{ label: 'A', value: 'abc' }],
        baseIntent(),
      );
      expect(insights).toEqual([]);
    });

    it('includes top, bottom, and share insights for grouped data', () => {
      const rows = [
        { label: 'East', value: 500 },
        { label: 'West', value: 300 },
        { label: 'North', value: 200 },
      ];
      const insights = generator.groupedMetricInsights(rows, baseIntent());
      expect(insights.some((i) => i.includes('East'))).toBe(true);
      expect(insights.some((i) => i.includes('North'))).toBe(true);
      expect(insights.some((i) => i.includes('account for'))).toBe(true);
    });

    it('includes trend insight for time-based dimensions', () => {
      const rows = [
        { label: 'Jan', value: 100 },
        { label: 'Feb', value: 150 },
        { label: 'Mar', value: 200 },
      ];
      const insights = generator.groupedMetricInsights(rows, {
        ...baseIntent(),
        dimensions: [timeField],
      });
      expect(insights.some((i) => i.includes('up'))).toBe(true);
    });

    it('includes outlier insight when enough rows', () => {
      const rows = [
        { label: 'A', value: 10 },
        { label: 'B', value: 10 },
        { label: 'C', value: 10 },
        { label: 'D', value: 10 },
        { label: 'E', value: 10 },
        { label: 'F', value: 100 },
      ];
      const insights = generator.groupedMetricInsights(rows, baseIntent());
      expect(insights.some((i) => i.includes('Above-average'))).toBe(true);
    });

    it('handles single row grouped input', () => {
      const insights = generator.groupedMetricInsights(
        [{ label: 'Only', value: 100 }],
        baseIntent(),
      );
      expect(insights.some((i) => i.includes('Only'))).toBe(true);
    });

    it('handles bottom label matching top label', () => {
      const insights = generator.groupedMetricInsights(
        [{ label: 'Same', value: 100 }],
        baseIntent(),
      );
      expect(insights.some((i) => i.includes('Same'))).toBe(true);
    });

    it('shows decreasing trend direction', () => {
      const rows = [
        { label: 'Jan', value: 200 },
        { label: 'Feb', value: 150 },
        { label: 'Mar', value: 100 },
      ];
      const insights = generator.groupedMetricInsights(rows, {
        ...baseIntent(),
        dimensions: [timeField],
      });
      expect(insights.some((i) => i.includes('down'))).toBe(true);
    });
  });
});
