import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ChartDecisionTree,
  ConfidenceScorer,
  ResultValidator,
  ResultShapeAnalyzer,
} from './result-analysis.ts';
import type { AskIntent, ResultShape, CatalogField, Diagnostics } from './types.ts';

// --- ChartDecisionTree helpers ---

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

const cdIntent = (overrides: Partial<AskIntent>): AskIntent => ({
  question: '',
  analysisType: 'kpi',
  metric: null,
  dimensions: [],
  filters: [],
  ...overrides,
});

const timeField = {
  id: 'sales::Order Date',
  table: 'sales',
  column: 'Order Date',
  role: 'time' as const,
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
const dimField = {
  ...timeField,
  id: 'customer::Region',
  column: 'Region',
  role: 'dimension' as const,
  label: 'Region',
};

// --- ConfidenceScorer helpers ---

const csSalesField = (): CatalogField => ({
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

const csRegionField = (): CatalogField => ({
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

const csBaseIntent = (overrides: Partial<AskIntent> = {}): AskIntent => ({
  question: 'sales by region',
  analysisType: 'kpi',
  metric: csSalesField(),
  dimensions: [csRegionField()],
  filters: [],
  ...overrides,
});

function csMakeScorer() {
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

// --- ResultValidator helpers ---

const rvNoIntent = (): AskIntent => ({
  question: '',
  analysisType: 'kpi',
  metric: null,
  dimensions: [],
  filters: [],
});
const rvWithDim = (): AskIntent => ({
  ...rvNoIntent(),
  dimensions: [
    {
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
      priority: 0,
      sampleValues: [],
      samples: [],
      dateProfile: null,
      cardinality: 4,
      rowCount: 100,
    },
  ],
});

// --- ResultShapeAnalyzer helpers ---

const rsaBaseIntent = (): AskIntent => ({
  question: '',
  analysisType: 'kpi',
  metric: null,
  dimensions: [],
  filters: [],
});
const rsaTimeIntent = (): AskIntent => ({
  ...rsaBaseIntent(),
  dimensions: [
    {
      id: 'sales::Order Date',
      table: 'sales',
      column: 'Order Date',
      role: 'time',
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
});

// ───────────────────────────────────────────────
// ChartDecisionTree
// ───────────────────────────────────────────────

describe('ChartDecisionTree', () => {
  let tree: ChartDecisionTree;
  beforeEach(() => {
    tree = new ChartDecisionTree();
  });

  it('returns table for list_values analysis', () => {
    expect(
      tree.decide(shape({}), cdIntent({ analysisType: 'list_values', dimensions: [dimField] }))
        .rendered,
    ).toBe('table');
  });

  it('returns table for yoy analysis', () => {
    expect(tree.decide(shape({}), cdIntent({ analysisType: 'yoy' })).rendered).toBe('table');
  });

  it('returns table for change analysis', () => {
    expect(tree.decide(shape({}), cdIntent({ analysisType: 'change' })).rendered).toBe('table');
  });

  it('returns bar for share analysis', () => {
    expect(
      tree.decide(
        shape({ numericCount: 2, categoricCount: 1 }),
        cdIntent({ analysisType: 'share', dimensions: [dimField] }),
      ).rendered,
    ).toBe('bar');
  });

  it('returns kpi for single aggregate with no dimension', () => {
    expect(
      tree.decide(
        shape({ numericCount: 1, categoricCount: 0, rowCount: 1, groupCount: 1 }),
        cdIntent({ dimensions: [] }),
      ).rendered,
    ).toBe('kpi');
  });

  it('returns line for a time-dimension query', () => {
    expect(
      tree.decide(
        shape({ numericCount: 1, categoricCount: 0, timeCount: 1, seriesCount: 1 }),
        cdIntent({ dimensions: [timeField] }),
      ).rendered,
    ).toBe('line');
  });

  it('returns bar for a categorical dimension with one numeric', () => {
    expect(
      tree.decide(
        shape({ numericCount: 1, categoricCount: 1, rowCount: 10, groupCount: 10 }),
        cdIntent({ dimensions: [dimField] }),
      ).rendered,
    ).toBe('bar');
  });

  it('falls back to table when recommended chart is disabled', () => {
    const noKpi = new ChartDecisionTree({ kpi: false });
    expect(
      noKpi.decide(
        shape({ numericCount: 1, rowCount: 1, groupCount: 1 }),
        cdIntent({ dimensions: [] }),
      ).rendered,
    ).toBe('table');
  });

  it('includes the decision path in the result', () => {
    const result = tree.decide(
      shape({}),
      cdIntent({ analysisType: 'list_values', dimensions: [dimField] }),
    );
    expect(result.path.length).toBeGreaterThan(0);
    expect(typeof result.reason).toBe('string');
  });
});

// ───────────────────────────────────────────────
// ConfidenceScorer
// ───────────────────────────────────────────────

describe('ConfidenceScorer', () => {
  describe('exact term match', () => {
    it('returns high score when question contains the field label exactly', () => {
      const { scorer } = csMakeScorer();
      const score = scorer.estimate(csBaseIntent({ question: 'sales by region' }));
      expect(score).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('join plan confidence', () => {
    it('reduces score when join plan returns an error', () => {
      const { scorer, buildJoinPlan } = csMakeScorer();
      buildJoinPlan.mockReturnValue({ error: 'No path found' });
      const score = scorer.estimate(csBaseIntent());
      expect(score).toBeLessThan(0.6);
    });

    it('calls buildJoinPlan with the metric table as base', () => {
      const { scorer, buildJoinPlan } = csMakeScorer();
      scorer.estimate(csBaseIntent());
      expect(buildJoinPlan).toHaveBeenCalledWith(
        'sales',
        expect.arrayContaining(['sales', 'customer']),
      );
    });
  });

  describe('dependency call tracking', () => {
    it('calls displayLabel for each field being scored', () => {
      const { scorer, displayLabel } = csMakeScorer();
      scorer.estimate(csBaseIntent());
      expect(displayLabel.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls localizedTerms for each field', () => {
      const { scorer, localizedTerms } = csMakeScorer();
      scorer.estimate(csBaseIntent());
      expect(localizedTerms.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls patternFromTerm to check for field label in the question', () => {
      const { scorer, patternFromTerm } = csMakeScorer();
      scorer.estimate(csBaseIntent());
      expect(patternFromTerm).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('returns a finite number between 0 and 1 for any well-formed intent', () => {
      const { scorer } = csMakeScorer();
      const score = scorer.estimate(csBaseIntent({ question: 'something completely unrelated xyz' }));
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
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

  describe('empty rows warning', () => {
    it('fires when rows array is empty', () => {
      const warnings = validator.validate({
        rows: [],
        intent: rvNoIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('No rows matched'))).toBe(true);
    });

    it('fires when every cell in every row is null', () => {
      const warnings = validator.validate({
        rows: [{ value: null }],
        intent: rvNoIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('No rows matched'))).toBe(true);
    });

    it('does not fire when rows have real values', () => {
      const warnings = validator.validate({
        rows: [{ label: 'West', value: 100 }],
        intent: rvNoIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('No rows matched'))).toBe(true);
    });
  });

  describe('low confidence warning', () => {
    it('fires when confidence is below 0.8', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: rvNoIntent(),
        confidence: 0.75,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('fuzzy or inferred'))).toBe(true);
    });

    it('does not fire at exactly 0.8', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: rvNoIntent(),
        confidence: 0.8,
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
        intent: rvWithDim(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.some((w) => w.includes('null or blank'))).toBe(true);
    });

    it('does not fire when all labels are non-blank', () => {
      const warnings = validator.validate({
        rows: [{ label: 'West', value: 100 }],
        intent: rvWithDim(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('null or blank'))).toBe(true);
    });

    it('does not fire when there are no dimensions', () => {
      const warnings = validator.validate({
        rows: [{ label: '', value: 100 }],
        intent: rvNoIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      expect(warnings.every((w) => !w.includes('null or blank'))).toBe(true);
    });
  });

  describe('diagnostic warnings are propagated', () => {
    it('propagates joinFanout.warning', () => {
      const diagnostics: Diagnostics = {
        joinFanout: { warning: 'Joined row count is 3.0x the base row count.' },
      };
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: rvNoIntent(),
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
        intent: rvNoIntent(),
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
        intent: rvNoIntent(),
        confidence: 0.97,
        diagnostics,
      });
      expect(warnings.some((w) => w.includes('2.5%'))).toBe(true);
    });

    it('emits no warnings when diagnostics is null', () => {
      const warnings = validator.validate({
        rows: [{ value: 1 }],
        intent: rvNoIntent(),
        confidence: 0.97,
        diagnostics: null,
      });
      const diagWarnings = warnings.filter(
        (w) => w.includes('Joined') || w.includes('Date parsing') || w.includes('Filters keep'),
      );
      expect(diagWarnings).toHaveLength(0);
    });
  });
});

// ───────────────────────────────────────────────
// ResultShapeAnalyzer
// ───────────────────────────────────────────────

describe('ResultShapeAnalyzer', () => {
  const analyzer = new ResultShapeAnalyzer();

  it('classifies a numeric column correctly', () => {
    const shape = analyzer.analyze([{ value: 100 }, { value: 200 }], ['value'], rsaBaseIntent());
    expect(shape.numeric).toContain('value');
    expect(shape.numericCount).toBe(1);
    expect(shape.hasMetric).toBe(true);
  });

  it('classifies a non-numeric column as categoric', () => {
    const shape = analyzer.analyze([{ label: 'West' }, { label: 'East' }], ['label'], rsaBaseIntent());
    expect(shape.categoric).toContain('label');
    expect(shape.categoricCount).toBe(1);
    expect(shape.hasMetric).toBe(false);
  });

  it('classifies the label column as time when intent has a time dimension', () => {
    const shape = analyzer.analyze(
      [{ label: '2017-01-01', value: 100 }],
      ['label', 'value'],
      rsaTimeIntent(),
    );
    expect(shape.time).toContain('label');
    expect(shape.timeCount).toBe(1);
  });

  it('counts rows and unique groups correctly', () => {
    const rows = [
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
      { label: 'A', value: 3 },
    ];
    const shape = analyzer.analyze(rows, ['label', 'value'], rsaBaseIntent());
    expect(shape.rowCount).toBe(3);
    expect(shape.groupCount).toBe(2);
  });

  it('infers columns from first row when columns parameter is omitted', () => {
    const shape = analyzer.analyze([{ label: 'X', value: 42 }], undefined, rsaBaseIntent());
    expect(shape.columns).toEqual(['label', 'value']);
  });
});
