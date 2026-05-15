import { describe, expect, it } from 'vitest';

import type {
  AskIntent,
  CatalogField,
  CountDistinctMetric,
  DateRange,
  IntentFilter,
} from '../../../shared/types/index';
import { IntentDescriber, type Labelable } from './intent-describer';

const displayLabel = (item: Labelable) => item.labels?.en || item.label || item.column || '';

const describer = new IntentDescriber(displayLabel);

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
  table: 'customer',
  column: 'Region',
  label: 'Region',
  role: 'dimension',
};

const measureField: CatalogField = {
  ...timeField,
  id: 'sales::Revenue',
  column: 'Revenue',
  label: 'Revenue',
  role: 'measure',
};

const measureFieldPt: CatalogField = {
  ...timeField,
  id: 'sales::Receita',
  column: 'Receita',
  label: 'Receita',
  labels: { en: 'Revenue', pt: 'Receita' },
  role: 'measure',
};

function baseIntent(overrides: Partial<AskIntent> = {}): AskIntent {
  return {
    question: 'revenue by region',
    analysisType: 'kpi',
    metric: measureField,
    dimensions: [dimField],
    filters: [],
    ...overrides,
  };
}

describe('IntentDescriber', () => {
  describe('describeMetricPart', () => {
    it('returns "Count records" for count_star', () => {
      const intent = baseIntent({
        metric: { kind: 'count_star', label: 'Records' },
      });
      expect(describer.describeMetricPart(intent)).toBe('Count records');
    });

    it('returns "Count distinct {label}" for count_distinct', () => {
      const entity = { label: 'Customer' } as CountDistinctMetric['entity'];
      const intent = baseIntent({
        metric: { kind: 'count_distinct' as const, entity, field: dimField, label: 'Customer' },
      });
      expect(describer.describeMetricPart(intent)).toBe('Count distinct Customer');
    });

    it('returns SUM(Field) for a plain measure field', () => {
      const intent = baseIntent({ metric: measureField });
      expect(describer.describeMetricPart(intent)).toBe('SUM(Revenue)');
    });

    it('uses the field aggregation when specified', () => {
      const aggField = { ...measureField, aggregation: 'AVG' };
      const intent = baseIntent({ metric: aggField });
      expect(describer.describeMetricPart(intent)).toBe('AVG(Revenue)');
    });

    it('resolves localized labels via displayLabel', () => {
      const intent = baseIntent({ metric: measureFieldPt });
      expect(describer.describeMetricPart(intent)).toBe('SUM(Revenue)');
    });
  });

  describe('describeFilterParts', () => {
    it('describes a single equality filter', () => {
      const filters: IntentFilter[] = [{ field: dimField, operator: '=', value: 'West' }];
      expect(describer.describeFilterParts(filters)).toBe('Region = West');
    });

    it('describes an IN filter with comma-separated values', () => {
      const filters: IntentFilter[] = [
        { field: dimField, operator: 'IN', values: ['East', 'West'] },
      ];
      expect(describer.describeFilterParts(filters)).toBe('Region in East, West');
    });

    it('joins multiple filters with " and "', () => {
      const filters: IntentFilter[] = [
        { field: dimField, operator: '=', value: 'West' },
        { field: timeField, operator: '=', value: '2024' },
      ];
      expect(describer.describeFilterParts(filters)).toBe('Region = West and Order Date = 2024');
    });

    it('returns empty string for empty filters', () => {
      expect(describer.describeFilterParts([])).toBe('');
    });
  });

  describe('describeDatePart', () => {
    it('describes monthOfYear kind', () => {
      const dateRange: DateRange = {
        field: timeField,
        kind: 'monthOfYear',
        month: 3,
        text: 'march',
      };
      expect(describer.describeDatePart(dateRange)).toBe(' in month 3');
    });

    it('describes regular date range with start/end', () => {
      const dateRange: DateRange = {
        field: timeField,
        start: '2024-01-01',
        end: '2024-12-31',
        text: 'in 2024',
      };
      expect(describer.describeDatePart(dateRange)).toBe(' from 2024-01-01 to 2024-12-31');
    });

    it('returns empty string for null dateRange', () => {
      expect(describer.describeDatePart(null)).toBe('');
      expect(describer.describeDatePart(undefined)).toBe('');
    });
  });

  describe('describeIntent', () => {
    it('describes list_values analysis type', () => {
      const intent = baseIntent({
        analysisType: 'list_values',
        dimensions: [dimField],
      });
      expect(describer.describeIntent(intent)).toBe('List Region');
    });

    it('describes yoy analysis type', () => {
      const intent = baseIntent({ analysisType: 'yoy' });
      expect(describer.describeIntent(intent)).toBe('Year-over-year Revenue');
    });

    it('describes change analysis type', () => {
      const intent = baseIntent({
        analysisType: 'change',
        change: { startYear: 2022, endYear: 2024 },
      });
      expect(describer.describeIntent(intent)).toBe('Revenue change from 2022 to 2024');
    });

    it('describes share analysis type', () => {
      const intent = baseIntent({
        analysisType: 'share',
        dimensions: [dimField],
      });
      expect(describer.describeIntent(intent)).toBe('Share of SUM(Revenue) by Region');
    });

    it('describes comparison analysis type', () => {
      const intent = baseIntent({
        analysisType: 'comparison',
        dimensions: [dimField],
      });
      expect(describer.describeIntent(intent)).toBe('Compare Revenue by Region');
    });

    it('describes default kpi with dimensions and filters', () => {
      const intent = baseIntent({
        analysisType: 'kpi',
        dimensions: [dimField],
        filters: [{ field: dimField, operator: '=', value: 'East' }],
      });
      const result = describer.describeIntent(intent);
      expect(result).toContain('SUM(Revenue) by Region');
      expect(result).toContain('where Region = East');
    });

    it('includes date range in description', () => {
      const intent = baseIntent({
        analysisType: 'kpi',
        dimensions: [dimField],
        dateRange: {
          field: timeField,
          start: '2024-01-01',
          end: '2024-12-31',
          text: 'in 2024',
        },
      });
      const result = describer.describeIntent(intent);
      expect(result).toContain('from 2024-01-01 to 2024-12-31');
    });

    it('includes time grain for time dimension', () => {
      const intent = baseIntent({
        analysisType: 'kpi',
        dimensions: [timeField],
        timeGrain: 'month',
      });
      const result = describer.describeIntent(intent);
      expect(result).toContain('(month)');
    });

    it('includes sort direction and limit', () => {
      const intent = baseIntent({
        analysisType: 'kpi',
        dimensions: [dimField],
        sort: { by: 'Revenue', direction: 'ASC' },
        limit: 10,
      });
      const result = describer.describeIntent(intent);
      expect(result).toContain('ascending');
      expect(result).toContain('limit 10');
    });
  });

  describe('describeEvidence', () => {
    it('describes count_star metric evidence', () => {
      const intent = baseIntent({
        metric: { kind: 'count_star', label: 'Records' },
        dimensions: [],
      });
      const evidence = describer.describeEvidence(intent);
      expect(evidence).toEqual([{ kind: 'metric', field: 'Records', source: 'count_star' }]);
    });

    it('describes count_distinct metric evidence', () => {
      const entity = { label: 'Customer' } as CountDistinctMetric['entity'];
      const field = { ...dimField, label: 'Customer' };
      const intent = baseIntent({
        metric: { kind: 'count_distinct' as const, entity, field, label: 'Customer' },
      });
      const evidence = describer.describeEvidence(intent);
      expect(evidence[0].kind).toBe('metric');
      expect(evidence[0].source).toBe('count_distinct');
    });

    it('describes regular metric evidence with default_metric source when default', () => {
      const defaultMeasure = { ...measureField, default: true };
      const intent = baseIntent({ metric: defaultMeasure });
      const evidence = describer.describeEvidence(intent);
      expect(evidence[0]).toEqual({
        kind: 'metric',
        field: 'Revenue',
        table: 'sales',
        column: 'Revenue',
        source: 'default_metric',
      });
    });

    it('describes regular metric evidence with resolved_field source when not default', () => {
      const intent = baseIntent({ metric: measureField });
      const evidence = describer.describeEvidence(intent);
      expect(evidence[0]).toEqual({
        kind: 'metric',
        field: 'Revenue',
        table: 'sales',
        column: 'Revenue',
        source: 'resolved_field',
      });
    });

    it('describes dimension evidence', () => {
      const intent = baseIntent({ dimensions: [dimField] });
      const evidence = describer.describeEvidence(intent);
      const dimEvidence = evidence.find((e) => e.kind === 'dimension');
      expect(dimEvidence).toEqual({
        kind: 'dimension',
        field: 'Region',
        table: 'customer',
        column: 'Region',
        source: 'resolved_field',
      });
    });

    it('describes filter evidence with equality operator', () => {
      const intent = baseIntent({
        filters: [{ field: dimField, operator: '=', value: 'East' }],
      });
      const evidence = describer.describeEvidence(intent);
      const filterEvidence = evidence.find((e) => e.kind === 'filter');
      expect(filterEvidence).toEqual({
        kind: 'filter',
        field: 'Region',
        table: 'customer',
        column: 'Region',
        value: 'East',
        source: 'resolved_value',
      });
    });

    it('describes filter evidence with IN operator', () => {
      const intent = baseIntent({
        filters: [{ field: dimField, operator: 'IN', values: ['East', 'West'] }],
      });
      const evidence = describer.describeEvidence(intent);
      const filterEvidence = evidence.find((e) => e.kind === 'filter');
      expect(filterEvidence!.value).toBe('East, West');
    });

    it('describes date range evidence', () => {
      const intent = baseIntent({
        dateRange: {
          field: timeField,
          start: '2024-01-01',
          end: '2024-12-31',
          text: 'in 2024',
        },
      });
      const evidence = describer.describeEvidence(intent);
      const dateEvidence = evidence.find((e) => e.kind === 'date');
      expect(dateEvidence).toEqual({
        kind: 'date',
        field: 'Order Date',
        table: 'sales',
        column: 'Order Date',
        source: 'date_range',
      });
    });

    it('produces empty evidence for null metric and no dimensions/filters/dates', () => {
      const intent = baseIntent({ metric: null, dimensions: [], filters: [] });
      const evidence = describer.describeEvidence(intent);
      expect(evidence).toEqual([]);
    });
  });
});
