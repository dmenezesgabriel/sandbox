import Fuse from 'fuse.js';
import { describe, expect, it } from 'vitest';

import type { CatalogField, ValueFuse, ValueItem } from '../../../shared/types/index';
import { ValueFilterResolver } from './value-filter-resolver';

const makeField = (overrides: Partial<CatalogField> & { id: string }): CatalogField => ({
  table: 'sales',
  column: overrides.column || overrides.id.split('::').pop() || 'col',
  role: 'dimension',
  type: 'VARCHAR',
  label: overrides.label || overrides.column || overrides.id.split('::').pop() || 'col',
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
  rowCount: 100,
  ...overrides,
});

const makeValueItem = (overrides: Partial<ValueItem> & Pick<ValueItem, 'field'>): ValueItem => ({
  value: overrides.normalizedValue || 'test',
  normalizedValue: overrides.normalizedValue || 'test',
  ...overrides,
});

const regionField = makeField({ id: 'sales::Region', column: 'Region', label: 'Region' });
const categoryField = makeField({ id: 'sales::Category', column: 'Category', label: 'Category' });
const statusField = makeField({ id: 'sales::Status', column: 'Status', label: 'Status' });
const _countryField = makeField({ id: 'sales::Country', column: 'Country', label: 'Country' });

const _displayLabel = (field: CatalogField) => field.label;
const _localizedTerms = () => [] as string[];

function makeResolver(options: {
  valueItems?: ValueItem[];
  valueFuseEntries?: ValueItem[];
  valuePhraseMaxWords?: number;
  displayLabel?: (field: CatalogField) => string;
  localizedTerms?: (field: CatalogField) => string[];
}) {
  const items = options.valueItems ?? [];
  const entries = options.valueFuseEntries ?? [];
  return new ValueFilterResolver({
    valueItems: () => items,
    valueFuse: () =>
      entries.length
        ? (new Fuse(entries, {
            keys: ['normalizedValue'],
            includeScore: true,
          }) as unknown as ValueFuse)
        : null,
    valuePhraseMaxWords: () => options.valuePhraseMaxWords ?? 1,
    displayLabel: options.displayLabel ?? ((f: CatalogField) => f.label),
    localizedTerms: options.localizedTerms ?? (() => []),
  });
}

describe('ValueFilterResolver', () => {
  describe('resolve() with exact value matches', () => {
    it('returns a filter when an exact value match is found in the query', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
          makeValueItem({ field: regionField, value: 'South', normalizedValue: 'south' }),
        ],
      });
      const result = resolver.resolve('sales in the north region');
      expect(result.filters!).toBeDefined();
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].value).toBe('North');
      expect(result.filters![0].field.id).toBe('sales::Region');
      expect(result.filters![0].operator).toBe('=');
      expect(result.filters![0].source).toBe('exact_value');
    });

    it('returns multiple filters when multiple exact values match', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
          makeValueItem({
            field: categoryField,
            value: 'Electronics',
            normalizedValue: 'electronics',
          }),
        ],
      });
      const result = resolver.resolve('north electronics sales');
      expect(result.filters!.length).toBe(2);
      const values = result.filters!.map((f) => f.value);
      expect(values).toContain('North');
      expect(values).toContain('Electronics');
    });

    it('returns empty filters when no values match', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const result = resolver.resolve('show me all sales');
      expect(result.filters!).toEqual([]);
    });

    it('skips value items with short normalized values', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: statusField, value: 'A', normalizedValue: 'a' }),
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const result = resolver.resolve('a north sales');
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].value).toBe('North');
    });

    it('skips value items with empty normalized values', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: '', normalizedValue: '' }),
          makeValueItem({
            field: categoryField,
            value: 'Electronics',
            normalizedValue: 'electronics',
          }),
        ],
      });
      const result = resolver.resolve('electronics');
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].value).toBe('Electronics');
    });

    it('deduplicates matches preferring higher matchScore', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({
            field: regionField,
            value: 'North',
            normalizedValue: 'north',
            matchScore: 0.5,
            matchSource: 'fuzzy',
          }),
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const matches = resolver.findMatches('sales in the north');
      const northMatches = matches.filter((m) => m.normalizedValue === 'north');
      expect(northMatches.length).toBe(1);
      expect(northMatches[0].matchScore).toBe(1);
      expect(northMatches[0].matchSource).toBe('exact_value');
    });

    it('uses score 0.9 as default when matchScore is absent', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const result = resolver.resolve('north');
      expect(result.filters![0].score).toBe(1);
    });
  });

  describe('resolve() with same-value deduplication', () => {
    it('keeps only one filter when same normalizedValue appears in multiple fields', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
          makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const result = resolver.resolve('sales in north');
      expect(result.filters!).toBeDefined();
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].value).toBe('North');
    });

    it('skips value whose normalizedValue is substring of existing key', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({
            field: regionField,
            value: 'North America',
            normalizedValue: 'north america',
          }),
          makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const result = resolver.resolve('sales in north america');
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].value).toBe('North America');
    });

    it('prefers longer normalizedValues first', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
          makeValueItem({
            field: categoryField,
            value: 'North America',
            normalizedValue: 'north america',
          }),
        ],
      });
      const result = resolver.resolve('north america sales');
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].value).toBe('North America');
    });
  });

  describe('resolveAmbiguousField()', () => {
    it('returns clarified item when slot matches and valueNormalized matches', () => {
      const resolver = makeResolver({ valueItems: [] });
      const items = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
      ];
      const uniqueFields = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
      ];
      const { clarified } = resolver.resolveAmbiguousField('sales in north', items, uniqueFields, {
        slot: 'filterField',
        valueNormalized: 'north',
        fieldId: 'sales::Region',
      });
      expect(clarified).toBeDefined();
      expect(clarified!.field.id).toBe('sales::Region');
    });

    it('returns null clarified when valueNormalized does not match', () => {
      const resolver = makeResolver({ valueItems: [] });
      const items = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
      ];
      const uniqueFields = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
      ];
      const { clarified } = resolver.resolveAmbiguousField('sales in north', items, uniqueFields, {
        slot: 'filterField',
        valueNormalized: 'different',
        fieldId: 'sales::Region',
      });
      expect(clarified).toBeNull();
    });

    it('resolves via displayLabel match in query text', () => {
      const resolver = makeResolver({ valueItems: [] });
      const uniqueFields = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
      ];
      const { cueHasFieldName } = resolver.resolveAmbiguousField(
        'sales in the north region',
        [],
        uniqueFields,
        null,
      );
      expect(cueHasFieldName).toBeDefined();
      expect(cueHasFieldName!.field.id).toBe('sales::Region');
    });

    it('resolves via field column name match in query text', () => {
      const resolver = makeResolver({ valueItems: [] });
      const uniqueFields = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
      ];
      const { cueHasFieldName } = resolver.resolveAmbiguousField(
        'north category sales',
        [],
        uniqueFields,
        null,
      );
      expect(cueHasFieldName).toBeDefined();
      expect(cueHasFieldName!.field.id).toBe('sales::Category');
    });

    it('resolves via localizedTerms match in query text', () => {
      const resolver = makeResolver({
        valueItems: [],
        localizedTerms: (f: CatalogField) => (f.id === 'sales::Region' ? ['regiao'] : []),
      });
      const uniqueFields = [
        makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
      ];
      const { cueHasFieldName } = resolver.resolveAmbiguousField(
        'north regiao sales',
        [],
        uniqueFields,
        null,
      );
      expect(cueHasFieldName).toBeDefined();
      expect(cueHasFieldName!.field.id).toBe('sales::Region');
    });
  });

  describe('findMatches() matching patterns', () => {
    it('matches values as word boundaries in the query', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const matches = resolver.findMatches('show sales in the north region');
      expect(matches.length).toBe(1);
      expect(matches[0].normalizedValue).toBe('north');
      expect(matches[0].matchSource).toBe('exact_value');
      expect(matches[0].matchScore).toBe(1);
    });

    it('does not match value as substring within a word', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const matches = resolver.findMatches('northeast sales');
      expect(matches.length).toBe(0);
    });

    it('matches multi-word values with flexible whitespace', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({
            field: regionField,
            value: 'North America',
            normalizedValue: 'north america',
          }),
        ],
      });
      const matches = resolver.findMatches('sales in north america');
      expect(matches.length).toBe(1);
      expect(matches[0].normalizedValue).toBe('north america');
    });

    it('returns empty array when no items match', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const matches = resolver.findMatches('something completely different');
      expect(matches).toEqual([]);
    });

    it('skips items with short normalized values under 2 characters', () => {
      const resolver = makeResolver({
        valueItems: [makeValueItem({ field: statusField, value: 'A', normalizedValue: 'a' })],
      });
      const matches = resolver.findMatches('status a');
      expect(matches.length).toBe(0);
    });

    it('upgrades matchScore when duplicate key found with higher score', () => {
      const resolver = makeResolver({
        valueItems: [
          makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
        ],
      });
      const matches = resolver.findMatches('north');
      expect(matches.length).toBe(1);
      expect(matches[0].matchScore).toBe(1);
      expect(matches[0].matchSource).toBe('exact_value');
    });
  });

  describe('toFilters() building filters from matches', () => {
    it('builds a single filter from a single value', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' })],
        ],
      ]);
      const result = resolver.toFilters('sales in the north', byValue);
      expect(result.filters!).toBeDefined();
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].field.id).toBe('sales::Region');
      expect(result.filters![0].value).toBe('North');
      expect(result.filters![0].operator).toBe('=');
    });

    it('builds filters for multiple distinct values', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' })],
        ],
        [
          'electronics',
          [
            makeValueItem({
              field: categoryField,
              value: 'Electronics',
              normalizedValue: 'electronics',
            }),
          ],
        ],
      ]);
      const result = resolver.toFilters('north electronics', byValue);
      expect(result.filters!.length).toBe(2);
    });

    it('deduplicates fields for a single value across items', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [
            makeValueItem({
              field: regionField,
              value: 'North',
              normalizedValue: 'north',
              matchScore: 1,
            }),
          ],
        ],
      ]);
      const result = resolver.toFilters('north', byValue);
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].field.id).toBe('sales::Region');
    });

    it('returns clarification when value maps to multiple unique fields', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [
            makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
            makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
          ],
        ],
      ]);
      const result = resolver.toFilters('north', byValue);
      expect(result.clarification).toBeDefined();
      expect(result.clarification!.message).toContain('North');
      expect(result.clarification!.pending.slot).toBe('filterField');
      expect(result.clarification!.pending.value).toBe('North');
      expect(result.clarification!.pending.valueNormalized).toBe('north');
      expect(result.clarification!.choices).toBeDefined();
      expect(result.clarification!.choices.length).toBe(2);
    });

    it('uses matchScore from value items when present', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [
            makeValueItem({
              field: regionField,
              value: 'North',
              normalizedValue: 'north',
              matchScore: 0.85,
              matchSource: 'fuzzy_value',
            }),
          ],
        ],
      ]);
      const result = resolver.toFilters('north', byValue);
      expect(result.filters![0].score).toBe(0.85);
      expect(result.filters![0].source).toBe('fuzzy_value');
    });

    it('defaults score to 0.9 when matchScore is absent', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' })],
        ],
      ]);
      const result = resolver.toFilters('north', byValue);
      expect(result.filters![0].score).toBe(0.9);
    });

    it('returns empty filters from empty map', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>();
      const result = resolver.toFilters('anything', byValue);
      expect(result.filters!).toEqual([]);
    });

    it('limits clarification candidates to 5', () => {
      const resolver = makeResolver({ valueItems: [] });
      const fields = Array.from({ length: 7 }, (_, i) =>
        makeField({ id: `sales::Field${i}`, column: `Field${i}`, label: `Field ${i}` }),
      );
      const items = fields.map((f) =>
        makeValueItem({ field: f, value: 'Alpha', normalizedValue: 'alpha' }),
      );
      const byValue = new Map<string, ValueItem[]>([['alpha', items]]);
      const result = resolver.toFilters('alpha', byValue);
      expect(result.clarification).toBeDefined();
      expect(result.clarification!.choices.length).toBe(5);
    });

    it('resolves ambiguity using clarification with matching field', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [
            makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
            makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
          ],
        ],
      ]);
      const clarification = {
        slot: 'filterField' as const,
        originalQuestion: null,
        valueNormalized: 'north',
        fieldId: 'sales::Region',
      };
      const result = resolver.toFilters('sales in north', byValue, clarification);
      expect(result.filters!).toBeDefined();
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].field.id).toBe('sales::Region');
      expect(result.filters![0].source).toBe('clarification');
    });

    it('resolves ambiguity when query text cues field label', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [
            makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
            makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
          ],
        ],
      ]);
      const result = resolver.toFilters('sales in north region', byValue);
      expect(result.filters!).toBeDefined();
      expect(result.filters!.length).toBe(1);
      expect(result.filters![0].field.id).toBe('sales::Region');
      expect(result.filters![0].source).toBeUndefined();
    });

    it('returns clarification when no cue disambiguates', () => {
      const resolver = makeResolver({ valueItems: [] });
      const byValue = new Map<string, ValueItem[]>([
        [
          'north',
          [
            makeValueItem({ field: regionField, value: 'North', normalizedValue: 'north' }),
            makeValueItem({ field: categoryField, value: 'North', normalizedValue: 'north' }),
          ],
        ],
      ]);
      const result = resolver.toFilters('sales in north', byValue);
      expect(result.clarification).toBeDefined();
      expect(result.clarification!.message).toContain('North');
      expect(result.clarification!.pending.slot).toBe('filterField');
      expect(result.clarification!.pending.value).toBe('North');
      expect(result.clarification!.pending.valueNormalized).toBe('north');
      expect(result.clarification!.choices.length).toBe(2);
    });
  });
});
