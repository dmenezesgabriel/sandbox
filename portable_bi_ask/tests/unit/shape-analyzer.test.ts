import { describe, it, expect } from 'vitest';
import { ResultShapeAnalyzer } from '../../src/result-analysis.ts';
import type { AskIntent } from '../../src/types.ts';

const baseIntent = (): AskIntent => ({
  question: '',
  analysisType: 'kpi',
  metric: null,
  dimensions: [],
  filters: [],
});
const timeIntent = (): AskIntent => ({
  ...baseIntent(),
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

describe('ResultShapeAnalyzer', () => {
  const analyzer = new ResultShapeAnalyzer();

  it('classifies a numeric column correctly', () => {
    const shape = analyzer.analyze([{ value: 100 }, { value: 200 }], ['value'], baseIntent());
    expect(shape.numeric).toContain('value');
    expect(shape.numericCount).toBe(1);
    expect(shape.hasMetric).toBe(true);
  });

  it('classifies a non-numeric column as categoric', () => {
    const shape = analyzer.analyze([{ label: 'West' }, { label: 'East' }], ['label'], baseIntent());
    expect(shape.categoric).toContain('label');
    expect(shape.categoricCount).toBe(1);
    expect(shape.hasMetric).toBe(false);
  });

  it('classifies the label column as time when intent has a time dimension', () => {
    const shape = analyzer.analyze(
      [{ label: '2017-01-01', value: 100 }],
      ['label', 'value'],
      timeIntent(),
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
    const shape = analyzer.analyze(rows, ['label', 'value'], baseIntent());
    expect(shape.rowCount).toBe(3);
    expect(shape.groupCount).toBe(2);
  });

  it('infers columns from first row when columns parameter is omitted', () => {
    const shape = analyzer.analyze([{ label: 'X', value: 42 }], undefined, baseIntent());
    expect(shape.columns).toEqual(['label', 'value']);
  });
});
