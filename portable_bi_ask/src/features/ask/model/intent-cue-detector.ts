import { norm, singularize } from '../../../shared/utils/utils';
import { TermMatcher } from './term-matcher';

export class IntentCueDetector {
  termMatcher: TermMatcher;

  constructor(termMatcher: TermMatcher) {
    this.termMatcher = termMatcher;
  }

  isListRequest(text) {
    return (
      (this.termMatcher.has(text, 'listAction') || this.termMatcher.has(text, 'listKind')) &&
      (this.termMatcher.has(text, 'listAvailability') ||
        this.termMatcher.has(text, 'listKind') ||
        this.termMatcher.has(text, 'listCategory') ||
        this.termMatcher.has(text, 'listSubcategory'))
    );
  }

  listFieldHint(text) {
    if (this.termMatcher.has(text, 'listSubcategory')) return 'sub category';
    if (this.termMatcher.has(text, 'listCategory')) return 'category';
    return null;
  }

  extractListPhrase(text) {
    const action = this.termMatcher.alternation('listAction');
    const availability = this.termMatcher.alternation('listAvailability');
    if (!action) return null;
    const match = norm(text).match(
      new RegExp(`\\b(?:${action})\\s+(.+?)(?:\\s+(?:${availability})|$)`),
    );
    const phrase = match?.[1];
    if (!phrase) return null;
    return this.cleanListPhrase(phrase);
  }

  cleanListPhrase(phrase) {
    const prepositions = this.termMatcher.alternation('prepositions');
    const kind = this.termMatcher.alternation('listKind');
    return phrase
      .replace(prepositions ? new RegExp(`\\b(?:${prepositions})\\b.+$`) : /$a/, '')
      .replace(kind ? new RegExp(`\\b(?:${kind})\\b\\s*(?:${prepositions})?`) : /$a/, '')
      .trim();
  }

  superlativeDirection(text) {
    if (this.termMatcher.has(text, 'bottom') || this.termMatcher.has(text, 'least')) return 'ASC';
    if (this.termMatcher.has(text, 'top') || this.termMatcher.has(text, 'most')) return 'DESC';
    return null;
  }

  extractSuperlativeSubject(text) {
    const mostOrLeast = [
      this.termMatcher.alternation('most'),
      this.termMatcher.alternation('least'),
    ]
      .filter(Boolean)
      .join('|');
    if (!mostOrLeast) return null;
    const normalized = norm(text);
    const question = this.termMatcher.alternation('subjectQuestion');
    const verb = this.termMatcher.alternation('ownershipVerb');
    const article = this.termMatcher.alternation('article');
    const patterns: RegExp[] = [
      question && verb
        ? new RegExp(
            `\\b(?:${question})\\s+(.+?)\\s+(?:${verb})\\s+(?:(?:${article})\\s+)?(?:${mostOrLeast})\\b`,
          )
        : null,
      new RegExp(`\\b(?:${mostOrLeast})\\s+.+?\\s+(.+)$`),
    ].filter((pattern): pattern is RegExp => pattern !== null);
    for (const pattern of patterns) {
      const phrase = normalized.match(pattern)?.[1];
      if (phrase) return singularize(phrase);
    }
    return null;
  }

  isYearOverYear(text) {
    return this.termMatcher.has(text, 'yearOverYear');
  }

  timeGrain(text) {
    if (this.termMatcher.has(text, 'dayGrain')) return 'day';
    if (this.termMatcher.has(text, 'monthGrain') || this.termMatcher.has(text, 'overTime'))
      return 'month';
    if (this.termMatcher.has(text, 'yearGrain')) return 'year';
    return null;
  }
}
