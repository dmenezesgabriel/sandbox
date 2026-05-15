import { describe, expect, it } from 'vitest';

import type { Vocabulary } from '../../../shared/types/index';
import { TermMatcher } from './term-matcher';
import { buildVocabulary } from './vocabulary';

describe('TermMatcher', () => {
  const vocab = buildVocabulary({});
  const en = new TermMatcher(vocab, 'en');
  const pt = new TermMatcher(vocab, 'pt');

  describe('terms', () => {
    it('returns deduplicated normalized terms for a group across all languages', () => {
      const byTerms = en.terms('by');
      expect(byTerms).toContain('by');
      expect(byTerms).toContain('por');
    });

    it('returns empty array for unknown group', () => {
      expect(en.terms('nonexistent')).toEqual([]);
    });
  });

  describe('alternation', () => {
    it('returns pipe-separated terms sorted longest-first', () => {
      const alt = en.alternation('by');
      expect(alt).toContain('by');
      expect(alt).toContain('por');
      const parts = alt.split('|');
      for (let i = 1; i < parts.length; i++) {
        expect(parts[i - 1].length).toBeGreaterThanOrEqual(parts[i].length);
      }
    });

    it('returns empty string for unknown group', () => {
      expect(en.alternation('nonexistent')).toBe('');
    });
  });

  describe('pattern', () => {
    it('returns a regex that matches known terms', () => {
      const pat = en.pattern('by');
      expect(pat).not.toBeNull();
      expect(pat!.test('sales by region')).toBe(true);
      expect(pat!.test('vendas por região')).toBe(true);
    });

    it('returns null for unknown group', () => {
      expect(en.pattern('nonexistent')).toBeNull();
    });

    it('respects flags parameter', () => {
      const pat = en.pattern('by', 'i');
      expect(pat!.flags).toContain('i');
    });
  });

  describe('patternFromTerm', () => {
    it('returns regex matching the given term word-boundary anchored', () => {
      const pat = en.patternFromTerm('region');
      expect(pat).not.toBeNull();
      expect(pat!.test('by region')).toBe(true);
      expect(pat!.test('regions')).toBe(false);
    });

    it('returns null for empty/whitespace term', () => {
      expect(en.patternFromTerm('')).toBeNull();
      expect(en.patternFromTerm('   ')).toBeNull();
    });
  });

  describe('has', () => {
    it('detects presence of a vocabulary term in text', () => {
      expect(en.has('sales by region', 'by')).toBe(true);
      expect(en.has('total sales', 'by')).toBe(false);
    });

    it('detects terms across locale families', () => {
      expect(pt.has('vendas por região', 'by')).toBe(true);
    });
  });

  describe('first', () => {
    it('returns the first matching term', () => {
      const match = en.first('sales by region', 'by');
      expect(match).toBe('by');
    });

    it('returns null when no match', () => {
      expect(en.first('total sales', 'by')).toBeNull();
    });
  });

  describe('with custom vocabulary', () => {
    const custom: Vocabulary = { en: { by: ['per'], top: ['topper'] } };
    const customMatcher = new TermMatcher(buildVocabulary(custom), 'en');

    it('includes custom terms', () => {
      expect(customMatcher.has('sales per region', 'by')).toBe(true);
      expect(customMatcher.has('topper products', 'top')).toBe(true);
    });
  });
});
