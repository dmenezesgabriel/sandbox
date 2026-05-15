import { describe, expect, it } from 'vitest';

import type { Vocabulary } from '../../../shared/types/index';
import { buildVocabulary, defaultVocabulary } from './vocabulary';

describe('buildVocabulary', () => {
  it('returns default vocabulary with en and pt groups when no overrides', () => {
    const vocab = buildVocabulary({});
    expect(vocab.en).toBeDefined();
    expect(vocab.pt).toBeDefined();
    expect(vocab.en.by).toEqual(expect.arrayContaining(['by']));
    expect(vocab.pt.by).toEqual(expect.arrayContaining(['por']));
  });

  it('includes all expected en groups', () => {
    const vocab = buildVocabulary({});
    const expectedGroups = [
      'by',
      'top',
      'bottom',
      'most',
      'least',
      'count',
      'overTime',
      'filters',
      'and',
      'prepositions',
      'listAction',
      'subjectQuestion',
      'ownershipVerb',
      'article',
      'listAvailability',
      'listKind',
      'listCategory',
      'listSubcategory',
      'latestYear',
      'latestMonth',
      'thisYear',
      'thisMonth',
      'dateCue',
      'yearCue',
      'monthCue',
      'dayCue',
      'dayGrain',
      'monthGrain',
      'yearGrain',
      'yearOverYear',
      'comparison',
      'change',
      'share',
      'unsupportedMetric',
    ];
    for (const group of expectedGroups) {
      expect(vocab.en[group]).toBeDefined();
    }
  });

  it('includes all expected pt groups', () => {
    const vocab = buildVocabulary({});
    const expectedGroups = [
      'by',
      'top',
      'bottom',
      'most',
      'least',
      'count',
      'overTime',
      'filters',
      'and',
      'prepositions',
      'listAction',
      'subjectQuestion',
      'ownershipVerb',
      'article',
      'listAvailability',
      'listKind',
      'listCategory',
      'listSubcategory',
      'latestYear',
      'latestMonth',
      'thisYear',
      'thisMonth',
      'dateCue',
      'yearCue',
      'monthCue',
      'dayCue',
      'dayGrain',
      'monthGrain',
      'yearGrain',
      'yearOverYear',
      'comparison',
      'change',
      'share',
      'unsupportedMetric',
    ];
    for (const group of expectedGroups) {
      expect(vocab.pt[group]).toBeDefined();
    }
  });

  it('merges user-configured terms into default groups', () => {
    const configured: Vocabulary = {
      en: { by: ['per'], filters: ['within'] },
    };
    const vocab = buildVocabulary(configured);
    expect(vocab.en.by).toEqual(expect.arrayContaining(['by', 'per']));
    expect(vocab.en.filters).toEqual(
      expect.arrayContaining(['in', 'for', 'where', 'with', 'within']),
    );
  });

  it('adds new language groups via configuration', () => {
    const configured: Vocabulary = {
      es: { by: ['por'], top: ['top', 'mejor'] },
    };
    const vocab = buildVocabulary(configured);
    expect(vocab.es).toBeDefined();
    expect(vocab.es.by).toEqual(expect.arrayContaining(['por']));
    expect(vocab.es.top).toEqual(expect.arrayContaining(['top', 'mejor']));
  });

  it('deduplicates merged terms', () => {
    const configured: Vocabulary = {
      en: { by: ['by'] },
    };
    const vocab = buildVocabulary(configured);
    const byTerms = vocab.en.by.filter((t) => t === 'by');
    expect(byTerms.length).toBe(1);
  });

  it('does not mutate the default vocabulary across calls', () => {
    buildVocabulary({ en: { by: ['per'] } });
    const vocab2 = buildVocabulary({});
    expect(vocab2.en.by).not.toContain('per');
  });

  it('returns defaults when called with undefined (engine path when askConfig.vocabulary is absent)', () => {
    const vocab = buildVocabulary(undefined as unknown as Vocabulary);
    expect(vocab.en).toBeDefined();
    expect(vocab.pt).toBeDefined();
    expect(vocab.en.by).toContain('by');
    expect(vocab.pt.by).toContain('por');
  });

  it('adds a new group to an existing locale without affecting other groups', () => {
    const vocab = buildVocabulary({ en: { customGroup: ['alpha', 'beta'] } });
    expect(vocab.en.customGroup).toEqual(expect.arrayContaining(['alpha', 'beta']));
    expect(vocab.en.by).toContain('by');
  });

  it('user config only extends default groups, never removes existing default terms', () => {
    const vocab = buildVocabulary({ en: { by: ['custom_by'] } });
    expect(vocab.en.by).toContain('by');
    expect(vocab.en.by).toContain('custom_by');
  });
});

describe('defaultVocabulary', () => {
  it('has matching en and pt group keys', () => {
    const enKeys = Object.keys(defaultVocabulary.en).sort();
    const ptKeys = Object.keys(defaultVocabulary.pt).sort();
    expect(enKeys).toEqual(ptKeys);
  });

  it('contains non-empty term arrays for every group', () => {
    for (const groups of Object.values(defaultVocabulary)) {
      for (const terms of Object.values(groups)) {
        expect(terms.length).toBeGreaterThan(0);
      }
    }
  });
});
