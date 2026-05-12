import { describe, expect, it } from 'vitest';

import { IntentCueDetector } from './intent-cue-detector';
import { TermMatcher } from './term-matcher';
import { buildVocabulary } from './vocabulary';

describe('IntentCueDetector', () => {
  const vocab = buildVocabulary({});
  const termMatcher = new TermMatcher(vocab, 'en');
  const cues = new IntentCueDetector(termMatcher);

  describe('isListRequest', () => {
    it('detects list questions with list action and list kind', () => {
      expect(cues.isListRequest('what types of products are there')).toBe(true);
    });

    it('detects list questions with list action and availability', () => {
      expect(cues.isListRequest('what products are available')).toBe(true);
    });

    it('detects list questions with list action and category', () => {
      expect(cues.isListRequest('what categories of items exist')).toBe(true);
    });

    it('returns false for non-list questions', () => {
      expect(cues.isListRequest('total sales by region')).toBe(false);
    });

    it('returns false when only list action is present without availability/kind/category', () => {
      expect(cues.isListRequest('what is the revenue')).toBe(false);
    });
  });

  describe('listFieldHint', () => {
    it('returns "sub category" for subcategory cues', () => {
      expect(cues.listFieldHint('list subcategory of products')).toBe('sub category');
    });

    it('returns "category" for category cues', () => {
      expect(cues.listFieldHint('list category of products')).toBe('category');
    });

    it('returns null when no category hint is present', () => {
      expect(cues.listFieldHint('show me products')).toBeNull();
    });
  });

  describe('extractListPhrase', () => {
    it('extracts the phrase after the list action', () => {
      const result = cues.extractListPhrase('what products are there');
      expect(result).toBe('products');
    });

    it('returns null when no list action is present', () => {
      expect(cues.extractListPhrase('total sales by region')).toBeNull();
    });

    it('strips prepositions and kind from the phrase', () => {
      const result = cues.extractListPhrase('what products are there');
      expect(result).toBeTruthy();
    });
  });

  describe('superlativeDirection', () => {
    it('returns "ASC" for bottom cues', () => {
      expect(cues.superlativeDirection('worst product')).toBe('ASC');
    });

    it('returns "ASC" for least cues', () => {
      expect(cues.superlativeDirection('least revenue')).toBe('ASC');
    });

    it('returns "DESC" for top cues', () => {
      expect(cues.superlativeDirection('top product')).toBe('DESC');
    });

    it('returns "DESC" for most cues', () => {
      expect(cues.superlativeDirection('most revenue')).toBe('DESC');
    });

    it('returns null when no superlative cue is present', () => {
      expect(cues.superlativeDirection('sales by region')).toBeNull();
    });
  });

  describe('extractSuperlativeSubject', () => {
    it('extracts subject from "which X has the most" pattern', () => {
      const result = cues.extractSuperlativeSubject('which region has the most sales');
      expect(result).toBeTruthy();
    });

    it('extracts subject from "most ... by/in X" pattern', () => {
      const result = cues.extractSuperlativeSubject('most sales by region');
      expect(result).toBeTruthy();
    });

    it('returns null when no superlative pattern matches', () => {
      expect(cues.extractSuperlativeSubject('sales by region')).toBeNull();
    });

    it('singularizes the extracted subject', () => {
      const result = cues.extractSuperlativeSubject('highest revenue by regions');
      expect(result).toBeTruthy();
    });
  });

  describe('isYearOverYear', () => {
    it('detects year-over-year phrases', () => {
      expect(cues.isYearOverYear('sales year over year')).toBe(true);
    });

    it('detects yoy abbreviation', () => {
      expect(cues.isYearOverYear('revenue yoy')).toBe(true);
    });

    it('detects year on year variant', () => {
      expect(cues.isYearOverYear('profit year on year')).toBe(true);
    });

    it('returns false for non-yoy text', () => {
      expect(cues.isYearOverYear('sales by region')).toBe(false);
    });
  });

  describe('timeGrain', () => {
    it('detects day grain', () => {
      expect(cues.timeGrain('sales per day')).toBe('day');
    });

    it('detects daily grain', () => {
      expect(cues.timeGrain('daily revenue')).toBe('day');
    });

    it('detects month grain', () => {
      expect(cues.timeGrain('monthly revenue')).toBe('month');
    });

    it('detects over-time as month grain', () => {
      expect(cues.timeGrain('revenue over time')).toBe('month');
    });

    it('detects year grain', () => {
      expect(cues.timeGrain('yearly revenue')).toBe('year');
    });

    it('detects annual as year grain', () => {
      expect(cues.timeGrain('annual revenue')).toBe('year');
    });

    it('returns null when no time grain cue is present', () => {
      expect(cues.timeGrain('sales by region')).toBeNull();
    });
  });
});
