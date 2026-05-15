import * as chronoEn from 'chrono-node/en';
import * as chronoPt from 'chrono-node/pt';
import { describe, expect, it } from 'vitest';

import type { CatalogField, DateProfile } from '../../../shared/types/index';
import { DateQuestionText } from './date-question-text';
import {
  DateRangeParser,
  NamedMonthDateParser,
  RelativePeriodDateParser,
} from './date-range-parser';
import { MonthCatalog } from './month-catalog';
import { TermMatcher } from './term-matcher';
import { buildVocabulary } from './vocabulary';

const dateProfile = (overrides: Partial<DateProfile> = {}): DateProfile => ({
  minDate: '2017-01-01',
  maxDate: '2018-12-31',
  latestMonthStart: '2018-12-01',
  latestMonthEnd: '2019-01-01',
  latestYearStart: '2018-01-01',
  latestYearEnd: '2019-01-01',
  ...overrides,
});

const timeField = (profile?: DateProfile): CatalogField => ({
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
  dateProfile: profile || null,
  cardinality: 0,
  rowCount: 0,
});

function makeParser(locale = 'en-US') {
  const vocab = buildVocabulary({});
  const termMatcher = new TermMatcher(vocab, locale.toLowerCase().startsWith('pt') ? 'pt' : 'en');
  const primaryParser = locale.toLowerCase().startsWith('pt') ? chronoPt : chronoEn;
  const fallbackParser = locale.toLowerCase().startsWith('pt') ? chronoEn : chronoPt;
  return new DateRangeParser({
    primaryParser,
    fallbackParser,
    termMatcher,
    locale,
  });
}

describe('DateRangeParser', () => {
  describe('with en-US locale', () => {
    const parser = makeParser('en-US');
    const field = timeField(dateProfile());

    it('parses "last year" with a dateProfile', () => {
      const result = parser.parse('sales last year', field);
      expect(result.dateRange).not.toBeNull();
      expect(result.dateRange!.start).toBe('2018-01-01');
      expect(result.dateRange!.end).toBe('2019-01-01');
      expect(result.questionWithoutDate).toBe('sales');
    });

    it('parses an explicit year like "in 2017"', () => {
      const result = parser.parse('sales in 2017', field);
      expect(result.dateRange).not.toBeNull();
      expect(result.dateRange!.start).toBe('2017-01-01');
      expect(result.dateRange!.end).toBe('2018-01-01');
    });

    it('parses a named month like "January 2017"', () => {
      const result = parser.parse('sales in January 2017', field);
      expect(result.dateRange).not.toBeNull();
      expect(result.dateRange!.start).toBe('2017-01-01');
      expect(result.dateRange!.end).toBe('2017-02-01');
    });

    it('returns null dateRange when no date is found', () => {
      const result = parser.parse('sales by region', field);
      expect(result.dateRange).toBeNull();
      expect(result.questionWithoutDate).toBe('sales by region');
    });

    it('returns null dateRange when field is null', () => {
      const result = parser.parse('sales in 2017', null as unknown as DateProfile);
      expect(result.dateRange).toBeNull();
    });

    it('parses "this month"', () => {
      const result = parser.parse('sales this month', field);
      expect(result.dateRange).not.toBeNull();
      expect(result.questionWithoutDate).toBeTruthy();
    });
  });
});

describe('RelativePeriodDateParser', () => {
  const vocab = buildVocabulary({});
  const termMatcher = new TermMatcher(vocab, 'en');
  const textTools = new DateQuestionText();

  it('parses "latest year" relative date', () => {
    const parser = new RelativePeriodDateParser(termMatcher, textTools);
    const field = timeField(dateProfile());
    const result = parser.parse('sales latest year', field);
    expect(result).not.toBeNull();
    expect(result!.dateRange.start).toBe('2018-01-01');
  });
});

describe('NamedMonthDateParser', () => {
  const textTools = new DateQuestionText();
  const catalog = new MonthCatalog('en-US');

  it('parses named month without year', () => {
    const parser = new NamedMonthDateParser(catalog, textTools);
    const field = timeField(dateProfile());
    const result = parser.parse('sales in March', field);
    expect(result).not.toBeNull();
    expect(result!.dateRange.kind).toBe('monthOfYear');
    expect(result!.dateRange.month).toBe(3);
  });

  it('parses named month with year', () => {
    const parser = new NamedMonthDateParser(catalog, textTools);
    const field = timeField(dateProfile());
    const result = parser.parse('sales in January 2017', field);
    expect(result).not.toBeNull();
    expect(result!.dateRange.start).toBe('2017-01-01');
    expect(result!.dateRange.end).toBe('2017-02-01');
  });
});
