import type { CatalogField, DateRange } from '../../../shared/types/index';
import {
  addDays,
  addMonths,
  isoDate,
  norm,
  startOfMonth,
  startOfYear,
} from '../../../shared/utils/utils';
import { DateQuestionText } from './date-question-text';
import { MonthCatalog } from './month-catalog';
import { TermMatcher } from './term-matcher';

export class RelativePeriodDateParser {
  termMatcher: TermMatcher;
  textTools: DateQuestionText;

  constructor(termMatcher: TermMatcher, textTools: DateQuestionText) {
    this.termMatcher = termMatcher;
    this.textTools = textTools;
  }

  parse(question, field) {
    const profile = field.dateProfile;
    const specs = [
      { group: 'latestYear', start: profile?.latestYearStart, end: profile?.latestYearEnd },
      { group: 'latestMonth', start: profile?.latestMonthStart, end: profile?.latestMonthEnd },
      { group: 'thisYear', calendar: 'year' },
      { group: 'thisMonth', calendar: 'month' },
    ];
    for (const spec of specs) {
      const text = this.termMatcher.first(question, spec.group);
      if (!text) continue;
      const range = this.rangeFor(spec);
      if (!range) return null;
      return {
        dateRange: { field, ...range, text },
        questionWithoutDate: this.textTools.removeText(question, text),
      };
    }
    return null;
  }

  rangeFor(spec) {
    if (!spec.calendar) return spec.start && spec.end ? { start: spec.start, end: spec.end } : null;
    if (spec.calendar === 'year') {
      const year = new Date().getFullYear();
      return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
    }
    if (spec.calendar === 'month') {
      const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1));
      return { start: isoDate(monthStart), end: isoDate(addMonths(monthStart, 1)) };
    }
    return null;
  }
}

export class NamedMonthDateParser {
  monthCatalog: MonthCatalog;
  textTools: DateQuestionText;

  constructor(monthCatalog: MonthCatalog, textTools: DateQuestionText) {
    this.monthCatalog = monthCatalog;
    this.textTools = textTools;
  }

  parse(question, field) {
    const match = this.monthCatalog.find(question);
    if (!match) return null;
    const questionWithoutDate = this.textTools.removeRange(
      question,
      match.index,
      match.text.length,
    );
    if (!match.year) {
      return {
        dateRange: { field, kind: 'monthOfYear' as const, month: match.number, text: match.text },
        questionWithoutDate,
      };
    }
    const startDate = new Date(Date.UTC(match.year, match.number - 1, 1));
    return {
      dateRange: {
        field,
        start: isoDate(startDate),
        end: isoDate(addMonths(startDate, 1)),
        text: match.text,
      },
      questionWithoutDate,
    };
  }
}

export class ChronoDateParser {
  primaryParser: {
    parse?: (
      text: string,
      ref: Date,
      opts: Record<string, unknown>,
    ) => Array<{
      text: string;
      index: number;
      start?: { date?: () => Date };
      end?: { date?: () => Date };
    }>;
  } | null;
  fallbackParser: {
    parse?: (
      text: string,
      ref: Date,
      opts: Record<string, unknown>,
    ) => Array<{
      text: string;
      index: number;
      start?: { date?: () => Date };
      end?: { date?: () => Date };
    }>;
  } | null;
  termMatcher: TermMatcher;
  monthCatalog: MonthCatalog;
  textTools: DateQuestionText;

  constructor({
    primaryParser,
    fallbackParser,
    termMatcher,
    monthCatalog,
    textTools,
  }: {
    primaryParser: ChronoDateParser['primaryParser'];
    fallbackParser: ChronoDateParser['fallbackParser'];
    termMatcher: TermMatcher;
    monthCatalog: MonthCatalog;
    textTools: DateQuestionText;
  }) {
    this.primaryParser = primaryParser;
    this.fallbackParser = fallbackParser;
    this.termMatcher = termMatcher;
    this.monthCatalog = monthCatalog;
    this.textTools = textTools;
  }

  parse(question, field) {
    if (!this.primaryParser?.parse) return null;
    const result =
      this.findResult(
        this.primaryParser.parse(question, new Date(), { forwardDate: false }) || [],
      ) ||
      this.findResult(
        this.fallbackParser?.parse?.(question, new Date(), { forwardDate: false }) || [],
        true,
      );
    if (!result) return null;
    const range = this.toDateRange(result, field);
    if (!range) return null;
    return {
      dateRange: range,
      questionWithoutDate: this.textTools.removeRange(question, result.index, result.text.length),
    };
  }

  findResult(results, strictNumeric = false) {
    return results.find(
      (result) =>
        this.hasDateCue(result.text) &&
        (!strictNumeric || !this.isAmbiguousNumericDate(result.text)),
    );
  }

  hasDateCue(text) {
    const normalized = norm(text);
    return (
      this.termMatcher.has(normalized, 'dateCue') ||
      this.monthCatalog.has(text) ||
      /^\d{4}$/.test(normalized) ||
      this.isAmbiguousNumericDate(text)
    );
  }

  isAmbiguousNumericDate(text) {
    return /\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/.test(String(text || ''));
  }

  toDateRange(result, field) {
    const text = norm(result.text);
    const startDate = result.start?.date?.();
    if (!startDate || Number.isNaN(startDate.getTime())) return null;
    const startUtc = new Date(
      Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
    );
    let start = startUtc;
    let end = result.end?.date?.();
    if (end && !Number.isNaN(end.getTime()))
      end = addDays(new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())), 1);

    const saysYear = this.termMatcher.has(text, 'yearCue') || /^\d{4}$/.test(text);
    const saysMonth = this.termMatcher.has(text, 'monthCue') || this.monthCatalog.has(result.text);
    const saysDay = this.termMatcher.has(text, 'dayCue');

    if (!end) {
      if (saysYear && !saysMonth && !saysDay) {
        start = startOfYear(startUtc);
        end = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
      } else if (saysMonth && !saysDay) {
        start = startOfMonth(startUtc);
        end = addMonths(start, 1);
      } else {
        end = addDays(startUtc, 1);
      }
    }
    return { field, start: isoDate(start), end: isoDate(end), text: result.text };
  }
}

export class ExplicitYearDateParser {
  textTools: DateQuestionText;

  constructor(textTools: DateQuestionText) {
    this.textTools = textTools;
  }

  parse(question, field) {
    const match = String(question || '').match(/\b(?:in|em|no|na)?\s*((?:19|20)\d{2})\b/i);
    if (!match) return null;
    const year = Number(match[1]);
    return {
      dateRange: { field, start: `${year}-01-01`, end: `${year + 1}-01-01`, text: match[0].trim() },
      questionWithoutDate: this.textTools.removeRange(question, match.index ?? 0, match[0].length),
    };
  }
}

export class DateRangeParser {
  parsers: Array<{
    parse: (
      question: string,
      field: CatalogField,
    ) => { dateRange: DateRange | null; questionWithoutDate: string } | null;
  }>;

  constructor({
    primaryParser,
    fallbackParser,
    termMatcher,
    locale,
  }: {
    primaryParser: ChronoDateParser['primaryParser'];
    fallbackParser: ChronoDateParser['fallbackParser'];
    termMatcher: TermMatcher;
    locale: string;
  }) {
    const textTools = new DateQuestionText();
    const monthCatalog = new MonthCatalog(locale);
    this.parsers = [
      new RelativePeriodDateParser(termMatcher, textTools),
      new NamedMonthDateParser(monthCatalog, textTools),
      new ChronoDateParser({ primaryParser, fallbackParser, termMatcher, monthCatalog, textTools }),
      new ExplicitYearDateParser(textTools),
    ];
  }

  parse(question, field) {
    if (!field) return { dateRange: null, questionWithoutDate: question };
    for (const parser of this.parsers) {
      const result = parser.parse(question, field);
      if (result) return result;
    }
    return { dateRange: null, questionWithoutDate: question };
  }
}
