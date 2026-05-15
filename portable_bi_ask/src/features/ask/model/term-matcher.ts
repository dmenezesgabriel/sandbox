import type { Vocabulary } from '../../../shared/types/index';
import { escapeRegExp, norm } from '../../../shared/utils/utils';

export class TermMatcher {
  vocabulary: Vocabulary;
  localeFamily: string;

  constructor(vocabulary: Vocabulary, localeFamily: string) {
    this.vocabulary = vocabulary || {};
    this.localeFamily = localeFamily || 'en';
  }

  terms(group) {
    return [
      ...new Set(
        Object.values(this.vocabulary)
          .flatMap((groups) => groups?.[group] || [])
          .map(norm)
          .filter(Boolean),
      ),
    ];
  }

  alternation(group) {
    return this.terms(group)
      .sort((a, b) => b.length - a.length)
      .map((term) => escapeRegExp(term).replace(/\s+/g, '\\s+'))
      .join('|');
  }

  pattern(group, flags = '') {
    const alt = this.alternation(group);
    return alt ? new RegExp(`\\b(?:${alt})\\b`, flags) : null;
  }

  patternFromTerm(term, flags = '') {
    const clean = norm(term);
    return clean ? new RegExp(`\\b${escapeRegExp(clean).replace(/\s+/g, '\\s+')}\\b`, flags) : null;
  }

  has(text, group) {
    const pattern = this.pattern(group);
    return !!pattern && pattern.test(norm(text));
  }

  first(text, group) {
    const pattern = this.pattern(group);
    return pattern ? norm(text).match(pattern)?.[0] || null : null;
  }
}
