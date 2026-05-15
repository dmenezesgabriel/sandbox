import { describe, expect, it } from 'vitest';

import type { CatalogField, ClarificationPending, FieldRole } from '../../../shared/types/index';
import { ExactFieldMatchStrategy, FieldResolver, FieldSearchIndex } from './field-search';
import { TermMatcher } from './term-matcher';

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

const salesField: CatalogField = makeField({
  id: 'sales::Sales',
  column: 'Sales',
  role: 'measure',
  label: 'Sales',
  synonyms: ['revenue'],
  priority: 20,
  type: 'DOUBLE',
});

const regionField: CatalogField = makeField({
  id: 'customer::Region',
  column: 'Region',
  role: 'dimension',
  label: 'Region',
});

const categoryField: CatalogField = makeField({
  id: 'product::Category',
  column: 'Category',
  role: 'dimension',
  label: 'Category',
  synonyms: ['product type'],
});

const orderDateField: CatalogField = makeField({
  id: 'sales::Order Date',
  column: 'Order Date',
  role: 'time',
  label: 'Order Date',
  type: 'VARCHAR',
});

const displayLabel = (field: CatalogField) => field.label;
const localizedTerms = () => [] as string[];

function makeCatalog(...fields: CatalogField[]) {
  return () => fields;
}

const dummyTermMatcher = {
  patternFromTerm: (term: string) => new RegExp(`\\b${term}\\b`, 'i'),
};

// ───────────────────────────────────────────────
// FieldSearchIndex
// ───────────────────────────────────────────────

describe('FieldSearchIndex', () => {
  describe('search', () => {
    it('returns matching fields filtered by role', () => {
      const index = new FieldSearchIndex({
        catalog: makeCatalog(regionField, salesField),
        displayLabel,
        localizedTerms,
      });
      index.rebuild();
      const results = index.search('Region', ['dimension' as FieldRole]);
      expect(results.length).toBe(1);
      expect(results[0].field.id).toBe('customer::Region');
    });

    it('returns empty array for empty query', () => {
      const index = new FieldSearchIndex({
        catalog: makeCatalog(regionField),
        displayLabel,
        localizedTerms,
      });
      index.rebuild();
      const results = index.search('', ['dimension' as FieldRole]);
      expect(results).toEqual([]);
    });

    it('excludes fields whose role is not in the roles filter', () => {
      const index = new FieldSearchIndex({
        catalog: makeCatalog(regionField, salesField),
        displayLabel,
        localizedTerms,
      });
      index.rebuild();
      const results = index.search('Region', ['measure' as FieldRole]);
      expect(results).toEqual([]);
    });

    it('finds fields by synonym text', () => {
      const index = new FieldSearchIndex({
        catalog: makeCatalog(salesField),
        displayLabel,
        localizedTerms,
      });
      index.rebuild();
      const results = index.search('revenue', ['measure' as FieldRole]);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].field.id).toBe('sales::Sales');
    });
  });

  describe('rebuild', () => {
    it('rebuilds the index with new catalog data', () => {
      const catalog = makeCatalog(regionField);
      const index = new FieldSearchIndex({
        catalog,
        displayLabel,
        localizedTerms,
      });
      index.rebuild();
      let results = index.search('Region', ['dimension' as FieldRole]);
      expect(results.length).toBe(1);

      const updatedCatalog = makeCatalog(regionField, categoryField);
      const newIndex = new FieldSearchIndex({
        catalog: updatedCatalog,
        displayLabel,
        localizedTerms,
      });
      newIndex.rebuild();
      results = newIndex.search('Category', ['dimension' as FieldRole]);
      expect(results.length).toBe(1);
      expect(results[0].field.id).toBe('product::Category');
    });

    it('clears previous entries on rebuild', () => {
      let fields = [regionField];
      const catalog = () => fields;
      const index = new FieldSearchIndex({ catalog, displayLabel, localizedTerms });
      index.rebuild();
      expect(index.search('Region', ['dimension' as FieldRole]).length).toBe(1);

      fields = [categoryField];
      index.rebuild();
      const regionResults = index.search('Region', ['dimension' as FieldRole]);
      expect(regionResults).toEqual([]);
      const catResults = index.search('Category', ['dimension' as FieldRole]);
      expect(catResults.length).toBe(1);
    });
  });
});

// ───────────────────────────────────────────────
// ExactFieldMatchStrategy
// ───────────────────────────────────────────────

describe('ExactFieldMatchStrategy', () => {
  const strategy = new ExactFieldMatchStrategy({
    catalog: makeCatalog(regionField, salesField, categoryField, orderDateField),
    displayLabel,
    localizedTerms,
    termMatcher: dummyTermMatcher as unknown as TermMatcher,
  });

  it('returns { field: null } for empty normalized phrase', async () => {
    const result = await strategy.matchPhrase('   ', ['dimension']);
    expect(result).toEqual({ field: null });
  });
});

// ───────────────────────────────────────────────
// FieldResolver
// ───────────────────────────────────────────────

describe('FieldResolver', () => {
  const clarify = (_pending: ClarificationPending, message: string, _fields: CatalogField[]) => ({
    clarification: { message, pending: _pending },
  });

  describe('resolvePhrase', () => {
    it('returns field from first matching strategy', async () => {
      const resolver = new FieldResolver(
        [
          {
            matchPhrase: async (_phrase, _roles) => ({
              field: regionField,
            }),
          },
        ],
        clarify,
      );
      const result = await resolver.resolvePhrase('region', ['dimension']);
      expect(result.field).toBe(regionField);
    });

    it('skips null strategies and tries the next one', async () => {
      const resolver = new FieldResolver(
        [
          {
            matchPhrase: async () => null,
          },
          {
            matchPhrase: async () => ({ field: salesField }),
          },
        ],
        clarify,
      );
      const result = await resolver.resolvePhrase('sales', ['measure']);
      expect(result.field).toBe(salesField);
    });

    it('returns undefined field when no strategy matches', async () => {
      const resolver = new FieldResolver(
        [{ matchPhrase: async () => null }, { matchPhrase: async () => null }],
        clarify,
      );
      const result = await resolver.resolvePhrase('unknown', ['dimension']);
      expect(result.field).toBeUndefined();
    });

    it('returns undefined field for blank phrase', async () => {
      const resolver = new FieldResolver(
        [{ matchPhrase: async () => ({ field: regionField }) }],
        clarify,
      );
      const result = await resolver.resolvePhrase('   ', ['dimension']);
      expect(result.field).toBeUndefined();
    });

    it('calls clarify when result is ambiguous', async () => {
      let clarifyCalled = false;
      const clarifyFn = (
        pending: ClarificationPending,
        message: string,
        fields: CatalogField[],
      ) => {
        clarifyCalled = true;
        return { clarification: { message, pending, choices: fields } };
      };
      const resolver = new FieldResolver(
        [
          {
            matchPhrase: async () => ({
              ambiguous: true,
              fields: [regionField, categoryField],
            }),
          },
        ],
        clarifyFn,
      );
      const result = await resolver.resolvePhrase('field', ['dimension']);
      expect(clarifyCalled).toBe(true);
      expect(result.clarification).toBeDefined();
    });

    it('resolves ambiguity with clarification when field IDs match', async () => {
      const resolver = new FieldResolver(
        [
          {
            matchPhrase: async () => ({
              ambiguous: true,
              fields: [regionField, categoryField],
            }),
          },
        ],
        clarify,
      );
      const result = await resolver.resolvePhrase('field', ['dimension'], {
        slot: 'field',
        originalQuestion: null,
        phrase: 'field',
        fieldId: 'customer::Region',
      });
      expect(result.field).toBe(regionField);
    });

    it('does not resolve ambiguity when phrase does not match clarification', async () => {
      const resolver = new FieldResolver(
        [
          {
            matchPhrase: async () => ({
              ambiguous: true,
              fields: [regionField, categoryField],
            }),
          },
        ],
        clarify,
      );
      const result = await resolver.resolvePhrase('field', ['dimension'], {
        slot: 'field',
        originalQuestion: null,
        phrase: 'different phrase',
        fieldId: 'customer::Region',
      });
      expect(result.clarification).toBeDefined();
    });
  });

  describe('findInText', () => {
    it('returns first non-null field from strategies', async () => {
      const resolver = new FieldResolver(
        [{ findInText: async () => null }, { findInText: async () => regionField }],
        clarify,
      );
      const result = await resolver.findInText('some region text', 'dimension');
      expect(result).toBe(regionField);
    });

    it('returns null when all strategies return null', async () => {
      const resolver = new FieldResolver(
        [{ findInText: async () => null }, { findInText: async () => null }],
        clarify,
      );
      const result = await resolver.findInText('nothing here', 'dimension');
      expect(result).toBeNull();
    });

    it('returns null when strategies have no findInText method', async () => {
      const resolver = new FieldResolver([{}], clarify);
      const result = await resolver.findInText('text', 'dimension');
      expect(result).toBeNull();
    });

    it('stops at first successful findInText', async () => {
      const resolver = new FieldResolver(
        [{ findInText: async () => regionField }, { findInText: async () => categoryField }],
        clarify,
      );
      const result = await resolver.findInText('text', 'dimension');
      expect(result).toBe(regionField);
    });
  });
});
