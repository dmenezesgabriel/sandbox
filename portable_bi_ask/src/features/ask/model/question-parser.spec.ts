import { describe, expect, it, vi } from 'vitest';

import type {
  CatalogField,
  ClarificationPending,
  IntentFilter,
  ParseOptions,
} from '../../../shared/types/index';
import { QuestionParser } from './question-parser';

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

const regionField = makeField({ id: 'sales::Region', column: 'Region', label: 'Region' });
const revenueField = makeField({
  id: 'sales::Revenue',
  column: 'Revenue',
  label: 'Revenue',
  role: 'measure',
});

function makeParser({
  resolveFieldPhrase,
  filterResolve,
}: {
  resolveFieldPhrase?: (
    phrase: string,
    roles: CatalogField['role'][],
    clarification: ClarificationPending | undefined,
  ) => Promise<{ field?: CatalogField; clarification?: unknown }>;
  filterResolve?: (
    q: string,
    clarification: ClarificationPending | undefined,
  ) => {
    filters: IntentFilter[];
    clarification?: unknown;
  };
}) {
  return new QuestionParser({
    catalog: () => [regionField, revenueField],
    entities: () => [],
    termMatcher: {
      terms: () => [],
      alternation: (group: string) => (group === 'by' ? 'by' : null),
      has: () => false,
      patternFromTerm: () => null,
      first: () => null,
    } as unknown as QuestionParser['termMatcher'],
    intentCues: {
      isListRequest: () => false,
      isYearOverYear: () => false,
      timeGrain: () => null,
      superlativeDirection: () => null,
      extractSuperlativeSubject: () => null,
      listFieldHint: () => null,
      extractListPhrase: () => null,
    } as unknown as QuestionParser['intentCues'],
    filterResolver: {
      resolve: filterResolve ?? (() => ({ filters: [] })),
    } as unknown as QuestionParser['filterResolver'],
    dateRangeParser: {
      parse: () => ({ dateRange: null, questionWithoutDate: null }),
    } as unknown as QuestionParser['dateRangeParser'],
    localizedTerms: () => [],
    resolveFieldPhrase: resolveFieldPhrase ?? (async () => ({ field: undefined })),
    findBestFieldInText: async () => null,
    getDefaultMetric: () => revenueField,
    getDefaultTimeField: () => undefined,
  });
}

describe('QuestionParser.parse()', () => {
  describe('ParseOptions threading', () => {
    it('accepts ParseOptions with typed clarification', async () => {
      const clarification: ClarificationPending = {
        slot: 'field',
        originalQuestion: 'show revenue by region',
        phrase: 'region',
        fieldId: 'sales::Region',
      };
      const options: ParseOptions = { clarification };

      const parser = makeParser({});
      const result = await parser.parse('show revenue', options);
      expect(result).toBeDefined();
    });

    it('passes clarification from ParseOptions to resolveFieldPhrase', async () => {
      const clarification: ClarificationPending = {
        slot: 'field',
        originalQuestion: 'show revenue by region',
        phrase: 'region',
        fieldId: 'sales::Region',
      };
      const receivedClarifications: (ClarificationPending | undefined)[] = [];
      const resolveFieldPhrase = async (
        _phrase: string,
        _roles: CatalogField['role'][],
        clr: ClarificationPending | undefined,
      ) => {
        receivedClarifications.push(clr);
        return { field: regionField };
      };

      const parser = makeParser({ resolveFieldPhrase });
      await parser.parse('show revenue by region', { clarification });

      expect(receivedClarifications.some((c) => c === clarification)).toBe(true);
    });

    it('passes clarification from ParseOptions to filterResolver.resolve', async () => {
      const clarification: ClarificationPending = {
        slot: 'filterField',
        originalQuestion: 'show revenue in north',
        value: 'north',
        valueNormalized: 'north',
      };
      const receivedClarifications: (ClarificationPending | undefined)[] = [];
      const filterResolve = vi.fn((_q: string, clr: ClarificationPending | undefined) => {
        receivedClarifications.push(clr);
        return { filters: [] as IntentFilter[] };
      });

      const parser = makeParser({ filterResolve });
      await parser.parse('show revenue in north', { clarification });

      expect(receivedClarifications.some((c) => c === clarification)).toBe(true);
    });

    it('passes undefined clarification when options is omitted', async () => {
      const receivedClarifications: (ClarificationPending | undefined)[] = [];
      const filterResolve = vi.fn((_q: string, clr: ClarificationPending | undefined) => {
        receivedClarifications.push(clr);
        return { filters: [] as IntentFilter[] };
      });

      const parser = makeParser({ filterResolve });
      await parser.parse('show revenue');

      expect(receivedClarifications.every((c) => c === undefined)).toBe(true);
    });
  });
});
