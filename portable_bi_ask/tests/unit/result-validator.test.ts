import { describe, it, expect, beforeEach } from 'vitest';
import { ResultValidator } from '../../src/result-analysis.ts';
import type { AskIntent, Diagnostics } from '../../src/types.ts';

const noIntent = (): AskIntent => ({ question: '', analysisType: 'kpi', metric: null, dimensions: [], filters: [] });
const withDim = (): AskIntent => ({ ...noIntent(), dimensions: [{ id: 'customer::Region', table: 'customer', column: 'Region', role: 'dimension', label: 'Region', labels: {}, synonyms: [], localizedSynonyms: {}, description: '', default: false, priority: 0, sampleValues: [], samples: [], dateProfile: null, cardinality: 4, rowCount: 100 }] });

describe('ResultValidator', () => {
  let validator: ResultValidator;
  beforeEach(() => { validator = new ResultValidator(); });

  describe('empty rows warning', () => {
    it('fires when rows array is empty', () => {
      const warnings = validator.validate({ rows: [], intent: noIntent(), confidence: 0.97, diagnostics: null });
      expect(warnings.some(w => w.includes('No rows matched'))).toBe(true);
    });

    it('fires when every cell in every row is null', () => {
      const warnings = validator.validate({ rows: [{ value: null }], intent: noIntent(), confidence: 0.97, diagnostics: null });
      expect(warnings.some(w => w.includes('No rows matched'))).toBe(true);
    });

    it('does not fire when rows have real values', () => {
      const warnings = validator.validate({ rows: [{ label: 'West', value: 100 }], intent: noIntent(), confidence: 0.97, diagnostics: null });
      expect(warnings.every(w => !w.includes('No rows matched'))).toBe(true);
    });
  });

  describe('low confidence warning', () => {
    it('fires when confidence is below 0.8', () => {
      const warnings = validator.validate({ rows: [{ value: 1 }], intent: noIntent(), confidence: 0.75, diagnostics: null });
      expect(warnings.some(w => w.includes('fuzzy or inferred'))).toBe(true);
    });

    it('does not fire at exactly 0.8', () => {
      const warnings = validator.validate({ rows: [{ value: 1 }], intent: noIntent(), confidence: 0.8, diagnostics: null });
      expect(warnings.every(w => !w.includes('fuzzy or inferred'))).toBe(true);
    });
  });

  describe('null or blank grouped label warning', () => {
    it('fires when a grouped row has an empty string label', () => {
      const warnings = validator.validate({ rows: [{ label: 'West', value: 100 }, { label: '', value: 50 }], intent: withDim(), confidence: 0.97, diagnostics: null });
      expect(warnings.some(w => w.includes('null or blank'))).toBe(true);
    });

    it('does not fire when all labels are non-blank', () => {
      const warnings = validator.validate({ rows: [{ label: 'West', value: 100 }], intent: withDim(), confidence: 0.97, diagnostics: null });
      expect(warnings.every(w => !w.includes('null or blank'))).toBe(true);
    });

    it('does not fire when there are no dimensions', () => {
      const warnings = validator.validate({ rows: [{ label: '', value: 100 }], intent: noIntent(), confidence: 0.97, diagnostics: null });
      expect(warnings.every(w => !w.includes('null or blank'))).toBe(true);
    });
  });

  describe('diagnostic warnings are propagated', () => {
    it('propagates joinFanout.warning', () => {
      const diagnostics: Diagnostics = { joinFanout: { warning: 'Joined row count is 3.0x the base row count.' } };
      const warnings = validator.validate({ rows: [{ value: 1 }], intent: noIntent(), confidence: 0.97, diagnostics });
      expect(warnings.some(w => w.includes('Joined row count'))).toBe(true);
    });

    it('propagates dateParse.warning', () => {
      const diagnostics: Diagnostics = { dateParse: { warning: 'Date parsing dropped 15 Order Date rows.' } };
      const warnings = validator.validate({ rows: [{ value: 1 }], intent: noIntent(), confidence: 0.97, diagnostics });
      expect(warnings.some(w => w.includes('Date parsing dropped'))).toBe(true);
    });

    it('propagates filterSelectivity.warning', () => {
      const diagnostics: Diagnostics = { filterSelectivity: { warning: 'Filters keep only 2.5% of rows.' } };
      const warnings = validator.validate({ rows: [{ value: 1 }], intent: noIntent(), confidence: 0.97, diagnostics });
      expect(warnings.some(w => w.includes('2.5%'))).toBe(true);
    });

    it('emits no warnings when diagnostics is null', () => {
      const warnings = validator.validate({ rows: [{ value: 1 }], intent: noIntent(), confidence: 0.97, diagnostics: null });
      const diagWarnings = warnings.filter(w => w.includes('Joined') || w.includes('Date parsing') || w.includes('Filters keep'));
      expect(diagWarnings).toHaveLength(0);
    });
  });
});
