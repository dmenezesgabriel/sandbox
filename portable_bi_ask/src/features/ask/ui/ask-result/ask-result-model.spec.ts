import { describe, expect, it } from 'vitest';

import type { AskSuccessResult } from '../../../../shared/types/index';
import {
  askResultToCsv,
  buildAskResultChartConfig,
  formatAskResultCell,
  importanceBadgeLabel,
} from './ask-result-model';

const baseResult: AskSuccessResult = {
  question: 'sales by region',
  interpretation: 'SUM(Sales) by Region',
  intent: {
    question: 'sales by region',
    analysisType: 'ranking',
    metric: null,
    dimensions: [],
    filters: [],
    timeField: null,
  },
  sql: 'SELECT region, SUM(sales) FROM sales',
  rows: [
    { label: 'West', value: 10 },
    { label: 'East', value: 20 },
  ],
  columns: ['label', 'value'],
  shape: {
    columns: ['label', 'value'],
    rowCount: 2,
    numeric: ['value'],
    categoric: ['label'],
    time: [],
    numericCount: 1,
    categoricCount: 1,
    timeCount: 0,
    seriesCount: 0,
    groupCount: 2,
    hasMetric: true,
    oneObservationPerGroup: true,
  },
  diagnostics: {},
  chartDecision: {
    path: ['grouped', 'bar'],
    recommended: 'bar',
    rendered: 'bar',
    alternatives: [],
    reason: 'Grouped metric with a categorical dimension.',
  },
  insights: [],
  narratives: null,
  evidence: [],
  chartType: 'bar',
  warnings: [],
  confidence: 0.9,
  metrics: { catalogBuildMs: 1, parseMs: 1, sqlExecutionMs: 1, totalAskMs: 3 },
};

describe('ask-result-model', () => {
  describe('buildAskResultChartConfig', () => {
    it('builds a categorical chart from result rows', () => {
      const config = buildAskResultChartConfig(baseResult);

      expect(config?.type).toBe('bar');
      expect(config?.data.labels).toEqual(['West', 'East']);
      expect(config?.data.datasets[0]).toMatchObject({
        label: 'SUM(Sales) by Region',
        data: [10, 20],
      });
    });

    it('returns null when scatter data is missing numeric axes', () => {
      const config = buildAskResultChartConfig({
        ...baseResult,
        chartType: 'scatter',
        shape: { ...baseResult.shape, numeric: [], numericCount: 0 },
      });

      expect(config).toBeNull();
    });
  });

  describe('askResultToCsv', () => {
    it('escapes quotes and preserves columns order', () => {
      const csv = askResultToCsv({
        ...baseResult,
        rows: [{ label: 'West "Prime"', value: 10 }],
      });

      expect(csv).toBe('"label","value"\n"West ""Prime""","10"');
    });
  });

  describe('formatAskResultCell', () => {
    it('formats percentage and currency-friendly value columns', () => {
      expect(formatAskResultCell('share', 0.123)).toBe('12.3%');
      expect(formatAskResultCell('value', 1200, 'currency')).toBe('$1,200');
    });
  });

  describe('importanceBadgeLabel', () => {
    it('returns the correct narrative badge label by threshold', () => {
      expect(importanceBadgeLabel(9)).toBe('Critical');
      expect(importanceBadgeLabel(8)).toBe('High');
      expect(importanceBadgeLabel(7)).toBe('Notable');
      expect(importanceBadgeLabel(6)).toBeNull();
    });
  });
});
