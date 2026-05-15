import { describe, expect, it } from 'vitest';

import type { CatalogField } from '../../../shared/types/index';
import { SemanticFieldMatcher } from './semantic-field-matcher';

const makeField = (overrides: Partial<CatalogField> = {}): CatalogField => ({
  id: 'sales::Region',
  table: 'sales',
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
  cardinality: 0,
  rowCount: 0,
  ...overrides,
});

describe('SemanticFieldMatcher', () => {
  describe('constructor', () => {
    it('uses defaults when config is empty', () => {
      const matcher = new SemanticFieldMatcher();
      expect(matcher.enabled).toBe(true);
      expect(matcher.model).toBe('onnx-community/all-MiniLM-L6-v2-ONNX');
      expect(matcher.minScore).toBe(0.42);
      expect(matcher.minMargin).toBe(0.04);
      expect(matcher.batchSize).toBe(16);
    });

    it('respects config overrides', () => {
      const matcher = new SemanticFieldMatcher({
        enabled: false,
        minScore: 0.5,
        minMargin: 0.1,
      });
      expect(matcher.enabled).toBe(false);
      expect(matcher.minScore).toBe(0.5);
      expect(matcher.minMargin).toBe(0.1);
    });
  });

  describe('matchField', () => {
    it('returns null when disabled', async () => {
      const matcher = new SemanticFieldMatcher({ enabled: false });
      const result = await matcher.matchField('region', ['dimension'], [makeField()]);
      expect(result).toBeNull();
    });

    it('returns null for empty or short text', async () => {
      const matcher = new SemanticFieldMatcher();
      const result = await matcher.matchField('', ['dimension'], []);
      expect(result).toBeNull();
    });

    it('returns null for single character text', async () => {
      const matcher = new SemanticFieldMatcher();
      const result = await matcher.matchField('a', ['dimension'], []);
      expect(result).toBeNull();
    });
  });

  describe('fieldText', () => {
    it('constructs text from field properties', () => {
      const matcher = new SemanticFieldMatcher(
        {},
        {
          displayLabel: (field) => field.label,
          localizedTerms: (_f) => [],
        },
      );
      const field = makeField({
        label: 'Region',
        column: 'Region',
        table: 'sales',
        role: 'dimension',
        description: 'Geographic area',
        synonyms: ['area', 'territory'],
      });
      const text = matcher.fieldText(field);
      expect(text).toContain('field: Region');
      expect(text).toContain('column: Region');
      expect(text).toContain('table: sales');
      expect(text).toContain('role: dimension');
      expect(text).toContain('Geographic area');
      expect(text).toContain('area');
      expect(text).toContain('territory');
    });
  });
});
