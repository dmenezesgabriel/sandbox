import { describe, it, expect, beforeEach } from 'vitest';
import { ChartDecisionTree } from '../../src/result-analysis.ts';
import type { AskIntent, ResultShape } from '../../src/types.ts';

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

const intent = (overrides: Partial<AskIntent>): AskIntent => ({
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

describe('ChartDecisionTree', () => {
  let tree: ChartDecisionTree;
  beforeEach(() => {
    tree = new ChartDecisionTree();
  });

  it('returns table for list_values analysis', () => {
    expect(
      tree.decide(shape({}), intent({ analysisType: 'list_values', dimensions: [dimField] }))
        .rendered,
    ).toBe('table');
  });

  it('returns table for yoy analysis', () => {
    expect(tree.decide(shape({}), intent({ analysisType: 'yoy' })).rendered).toBe('table');
  });

  it('returns table for change analysis', () => {
    expect(tree.decide(shape({}), intent({ analysisType: 'change' })).rendered).toBe('table');
  });

  it('returns bar for share analysis', () => {
    expect(
      tree.decide(
        shape({ numericCount: 2, categoricCount: 1 }),
        intent({ analysisType: 'share', dimensions: [dimField] }),
      ).rendered,
    ).toBe('bar');
  });

  it('returns kpi for single aggregate with no dimension', () => {
    expect(
      tree.decide(
        shape({ numericCount: 1, categoricCount: 0, rowCount: 1, groupCount: 1 }),
        intent({ dimensions: [] }),
      ).rendered,
    ).toBe('kpi');
  });

  it('returns line for a time-dimension query', () => {
    expect(
      tree.decide(
        shape({ numericCount: 1, categoricCount: 0, timeCount: 1, seriesCount: 1 }),
        intent({ dimensions: [timeField] }),
      ).rendered,
    ).toBe('line');
  });

  it('returns bar for a categorical dimension with one numeric', () => {
    expect(
      tree.decide(
        shape({ numericCount: 1, categoricCount: 1, rowCount: 10, groupCount: 10 }),
        intent({ dimensions: [dimField] }),
      ).rendered,
    ).toBe('bar');
  });

  it('falls back to table when recommended chart is disabled', () => {
    const noKpi = new ChartDecisionTree({ kpi: false });
    expect(
      noKpi.decide(
        shape({ numericCount: 1, rowCount: 1, groupCount: 1 }),
        intent({ dimensions: [] }),
      ).rendered,
    ).toBe('table');
  });

  it('includes the decision path in the result', () => {
    const result = tree.decide(
      shape({}),
      intent({ analysisType: 'list_values', dimensions: [dimField] }),
    );
    expect(result.path.length).toBeGreaterThan(0);
    expect(typeof result.reason).toBe('string');
  });
});
