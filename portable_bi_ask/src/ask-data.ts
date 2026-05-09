import * as chronoEn from 'chrono-node/en';
import * as chronoPt from 'chrono-node/pt';
import Fuse from 'fuse.js';
import MiniSearch from 'minisearch';

import {
  ChartDecisionTree,
  ConfidenceScorer,
  InsightGenerator,
  ResultShapeAnalyzer,
  ResultValidator,
} from './result-analysis';
import type {
  CatalogField,
  DateRange,
  Diagnostics,
  Entity,
  FieldFuse,
  FieldRole,
  FieldSearchIndexType,
  IntentFilter,
  IntentMetric,
  Relationship,
  SemanticMatchingConfig,
  ValueFuse,
  ValueItem,
  Vocabulary,
} from './types';
import {
  addDays,
  addMonths,
  asIsoDate,
  compact,
  cosineSimilarity,
  detectDateFormat,
  escapeRegExp,
  escapeSqlString,
  fieldKey,
  isDateName,
  isIdLike,
  isNumericType,
  isoDate,
  norm,
  numberValue,
  quoteIdent,
  safeAlias,
  singularize,
  startOfMonth,
  startOfYear,
  toRows,
} from './utils';
import { SemanticModelingEngine } from './semantic-modeling';
import { NarrativeGenerator, type Narrative, type NarrativeResult } from './narrative-generator';

export class SemanticFieldMatcher {
  config: SemanticMatchingConfig;
  helpers: { displayLabel?: (field: CatalogField) => string; localizedTerms?: (field: CatalogField) => string[] };
  enabled: boolean;
  model: string;
  dtype: string;
  minScore: number;
  minMargin: number;
  batchSize: number;
  extractor: unknown;
  catalogKey: string;
  index: { field: CatalogField; embedding: unknown }[];
  loading: Promise<boolean> | null;
  queryCache: Map<string, unknown>;

  constructor(config: SemanticMatchingConfig = {}, helpers: { displayLabel?: (field: CatalogField) => string; localizedTerms?: (field: CatalogField) => string[] } = {}) {
    this.config = config;
    this.helpers = helpers;
    this.enabled = config.enabled !== false;
    this.model = config.model || 'onnx-community/all-MiniLM-L6-v2-ONNX';
    this.dtype = config.dtype || 'q4';
    this.minScore = config.minScore ?? 0.42;
    this.minMargin = config.minMargin ?? 0.04;
    this.batchSize = config.batchSize || 16;
    this.extractor = null;
    this.catalogKey = '';
    this.index = [];
    this.loading = null;
    this.queryCache = new Map();
  }

  async matchField(text, roles, catalog) {
    const clean = norm(text);
    if (!this.enabled || !clean || clean.length < 2) return null;
    const ready = await this.initialize(catalog);
    if (!ready) return null;
    const embedding = await this.embedOne(clean);
    if (!embedding) return null;
    const scored = this.index
      .filter((item) => roles.includes(item.field.role))
      .map((item) => ({ ...item, score: cosineSimilarity(embedding as ArrayLike<number>, item.embedding as ArrayLike<number>) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < this.minScore) return null;
    const second = scored[1];
    if (second && best.score - second.score < this.minMargin) {
      return {
        ambiguous: true,
        fields: scored.slice(0, 4).map((item) => item.field),
        score: best.score,
      };
    }
    return { field: best.field, score: best.score };
  }

  async initialize(catalog) {
    const catalogKey = catalog.map((field) => field.id).join('|');
    if (this.extractor && this.catalogKey === catalogKey) return true;
    if (this.loading) return this.loading;
    this.loading = this.load(catalog, catalogKey);
    return this.loading;
  }

  async load(catalog, catalogKey) {
    try {
      const { pipeline, env, LogLevel } = await import('@huggingface/transformers');
      env.logLevel = LogLevel.ERROR;
      this.extractor = await pipeline('feature-extraction', this.model, { dtype: this.dtype as 'q4' | 'auto' | 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'bnb4' | 'q4f16' });
      const texts = catalog.map((field) => this.fieldText(field));
      const embeddings = await this.embedBatch(texts);
      this.index = catalog
        .map((field, index) => ({ field, embedding: embeddings[index] }))
        .filter((item) => item.embedding);
      this.catalogKey = catalogKey;
      this.queryCache.clear();
      return true;
    } catch (err) {
      this.enabled = false;
      console.warn('[AskData] Semantic field matching disabled', err);
      return false;
    } finally {
      this.loading = null;
    }
  }

  fieldText(field) {
    const displayLabel = this.helpers.displayLabel?.(field) || field.label || field.column;
    const localizedTerms = this.helpers.localizedTerms?.(field) || [];
    return [
      `field: ${displayLabel}`,
      `column: ${field.column}`,
      `table: ${field.table}`,
      `role: ${field.role}`,
      field.description,
      ...(field.synonyms || []),
      ...localizedTerms,
    ]
      .filter(Boolean)
      .join('. ');
  }

  async embedOne(text) {
    const key = norm(text);
    if (this.queryCache.has(key)) return this.queryCache.get(key);
    const [embedding] = await this.embedBatch([text]);
    this.queryCache.set(key, embedding);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<unknown[]> {
    const vectors: unknown[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const output = await (this.extractor as (batch: string[], opts: Record<string, unknown>) => Promise<unknown>)(batch, { pooling: 'mean', normalize: true });
      vectors.push(...this.tensorRows(output));
    }
    return vectors;
  }

  tensorRows(tensor: unknown): unknown[] {
    const t = tensor as { dims?: number[]; data?: ArrayLike<number> };
    const dims = t.dims || [];
    const data = t.data || [];
    if (dims.length === 1) return [Float32Array.from(data as ArrayLike<number>)];
    const rows = dims[0] || 0;
    const width = dims.slice(1).reduce((product, value) => product * value, 1);
    const arr = data as ArrayLike<number> & { slice(start: number, end: number): unknown };
    return Array.from({ length: rows }, (_, row) => arr.slice(row * width, (row + 1) * width));
  }
}

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

export class MonthCatalog {
  locale: string;
  months: { term: string; number: number }[];

  constructor(locale: string) {
    this.locale = locale || 'en-US';
    this.months = this.buildMonths();
  }

  buildMonths() {
    const locales = [...new Set(['en-US', 'pt-BR', this.locale])];
    const byTerm = new Map();
    for (let month = 0; month < 12; month++) {
      for (const locale of locales) {
        for (const style of ['long', 'short'] as const) {
          const label = new Intl.DateTimeFormat(locale, { month: style })
            .format(new Date(2024, month, 15))
            .replace(/\.$/, '');
          for (const term of [label, norm(label)]) {
            if (term) byTerm.set(term.toLowerCase(), month + 1);
          }
        }
      }
    }
    return [...byTerm.entries()]
      .map(([term, number]) => ({ term, number }))
      .sort((a, b) => b.term.length - a.term.length);
  }

  find(text) {
    for (const item of this.months) {
      const pattern = new RegExp(`\\b${escapeRegExp(item.term)}\\b(?:\\s+((?:19|20)\\d{2}))?`, 'i');
      const match = String(text || '').match(pattern);
      if (match)
        return {
          ...item,
          text: match[0],
          index: match.index ?? 0,
          year: match[1] ? Number(match[1]) : null,
        };
    }
    return null;
  }

  has(text) {
    return !!this.find(text);
  }
}

export class DateQuestionText {
  removeText(question, text) {
    const normalizedQuestion = norm(question);
    const normalizedText = norm(text);
    const normalizedPattern = new RegExp(
      `\\b${escapeRegExp(normalizedText).replace(/\s+/g, '\\s+')}\\b`,
    );
    const normalizedResult = normalizedQuestion
      .replace(normalizedPattern, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalizedResult !== normalizedQuestion) return normalizedResult;
    const originalPattern = new RegExp(`\\b${escapeRegExp(text).replace(/\s+/g, '\\s+')}\\b`, 'i');
    return String(question || '')
      .replace(originalPattern, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  removeRange(question, index, length) {
    return `${question.slice(0, index)} ${question.slice(index + length)}`
      .replace(/\s+/g, ' ')
      .trim();
  }
}

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
  primaryParser: { parse?: (text: string, ref: Date, opts: Record<string, unknown>) => Array<{ text: string; index: number; start?: { date?: () => Date }; end?: { date?: () => Date } }> } | null;
  fallbackParser: { parse?: (text: string, ref: Date, opts: Record<string, unknown>) => Array<{ text: string; index: number; start?: { date?: () => Date }; end?: { date?: () => Date } }> } | null;
  termMatcher: TermMatcher;
  monthCatalog: MonthCatalog;
  textTools: DateQuestionText;

  constructor({ primaryParser, fallbackParser, termMatcher, monthCatalog, textTools }: {
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
  parsers: Array<{ parse: (question: string, field: CatalogField) => { dateRange: DateRange | null; questionWithoutDate: string } | null }>;

  constructor({ primaryParser, fallbackParser, termMatcher, locale }: {
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

export class FieldSearchIndex {
  catalog: () => CatalogField[];
  displayLabel: (field: CatalogField) => string;
  localizedTerms: (field: CatalogField) => string[];
  fieldById: Map<string, CatalogField>;
  index: FieldSearchIndexType;

  constructor({ catalog, displayLabel, localizedTerms }: {
    catalog: () => CatalogField[];
    displayLabel: (field: CatalogField) => string;
    localizedTerms: (field: CatalogField) => string[];
  }) {
    this.catalog = catalog;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.fieldById = new Map();
    this.index = new MiniSearch({
      fields: ['text'],
      storeFields: ['role'],
      searchOptions: { combineWith: 'AND' },
    });
  }

  rebuild() {
    this.index = new MiniSearch({
      fields: ['text'],
      storeFields: ['role'],
      searchOptions: { combineWith: 'AND' },
    });
    this.fieldById.clear();
    const docs = this.catalog().map((field) => {
      this.fieldById.set(field.id, field);
      return {
        id: field.id,
        role: field.role,
        text: norm(
          [
            this.displayLabel(field),
            field.label,
            field.column,
            field.table,
            field.role,
            field.description,
            ...(field.synonyms || []),
            ...Object.values(field.localizedSynonyms || {}).flat(),
            ...this.localizedTerms(field),
          ]
            .filter(Boolean)
            .join(' '),
        ),
      };
    });
    this.index.addAll(docs);
  }

  search(query, roles): { field: CatalogField; score: number }[] {
    const clean = norm(query);
    if (!clean) return [];
    return this.index
      .search(clean, { combineWith: 'AND' })
      .filter((result) => roles.includes(result.role))
      .map((result) => ({ field: this.fieldById.get(result.id), score: result.score }))
      .filter((result): result is { field: CatalogField; score: number } => !!result.field)
      .sort((a, b) => b.score - a.score);
  }
}

export class TextSearchFieldMatchStrategy {
  fieldSearchIndex: () => FieldSearchIndex | null;

  constructor({ fieldSearchIndex }: { fieldSearchIndex: () => FieldSearchIndex | null }) {
    this.fieldSearchIndex = fieldSearchIndex;
  }

  async matchPhrase(phrase, roles) {
    const index = this.fieldSearchIndex();
    if (!index) return null;
    const results = index.search(phrase, roles).slice(0, 4);
    if (!results.length || results[0].score < 0.9) return null;
    if (results[1] && results[0].score - results[1].score < 0.15)
      return {
        ambiguous: true,
        fields: results.map((result) => result.field).filter((f): f is CatalogField => !!f),
        score: results[0].score,
      };
    return { field: results[0].field, score: Math.min(0.9, results[0].score / 3) };
  }

  async findInText(text, role) {
    const index = this.fieldSearchIndex();
    if (!index) return null;
    const result = index.search(text, [role])[0];
    return result && result.score >= 1.1 ? result.field ?? null : null;
  }
}

export class ExactFieldMatchStrategy {
  catalog: () => CatalogField[];
  displayLabel: (field: CatalogField) => string;
  localizedTerms: (field: CatalogField) => string[];
  termMatcher: TermMatcher;

  constructor({ catalog, displayLabel, localizedTerms, termMatcher }: {
    catalog: () => CatalogField[];
    displayLabel: (field: CatalogField) => string;
    localizedTerms: (field: CatalogField) => string[];
    termMatcher: TermMatcher;
  }) {
    this.catalog = catalog;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.termMatcher = termMatcher;
  }

  async matchPhrase(phrase, roles) {
    const clean = norm(phrase);
    if (!clean) return { field: null };
    const direct = this.directMatches(clean, roles);
    if (!direct.length) return null;
    direct.sort((a, b) => b.score - a.score);
    if (direct[1] && direct[0].score - direct[1].score < 0.03)
      return { ambiguous: true, fields: direct.slice(0, 4).map((match) => match.field) };
    return { field: direct[0].field };
  }

  async findInText(text, role) {
    const candidates: { field: CatalogField; score: number }[] = [];
    for (const field of this.catalog().filter((field) => field.role === role)) {
      for (const term of this.fieldTerms(field)) {
        if (this.termMatcher.patternFromTerm(term)?.test(text)) {
          candidates.push({
            field,
            score:
              term.length +
              (field.priority || 0) +
              (this.activeTerms(field).includes(term) ? 10 : 0),
          });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.field || null;
  }

  directMatches(clean, roles) {
    const byField = new Map();
    for (const field of this.catalog().filter((field) => roles.includes(field.role))) {
      for (const term of this.fieldTerms(field)) {
        if (clean === term || clean === singularize(term) || term === singularize(clean)) {
          const score =
            1 + (field.priority || 0) / 100 + (this.activeTerms(field).includes(term) ? 0.1 : 0);
          const previous = byField.get(field.id);
          if (!previous || score > previous.score) byField.set(field.id, { field, score });
        }
      }
    }
    return [...byField.values()];
  }

  fieldTerms(field) {
    return [
      ...new Set(
        [field.label, field.column, ...(field.synonyms || []), ...this.activeTerms(field)]
          .map(norm)
          .filter(Boolean),
      ),
    ];
  }

  activeTerms(field) {
    return [this.displayLabel(field), ...this.localizedTerms(field)].map(norm).filter(Boolean);
  }
}

export class FuseFieldMatchStrategy {
  fieldFuse: () => FieldFuse | null;

  constructor({ fieldFuse }: { fieldFuse: () => FieldFuse | null }) {
    this.fieldFuse = fieldFuse;
  }

  async matchPhrase(phrase, roles) {
    const fuse = this.fieldFuse();
    if (!fuse) return null;
    const results = fuse
      .search(norm(phrase))
      .filter((result) => roles.includes(result.item.field.role))
      .slice(0, 4);
    if (!results.length || (results[0].score ?? 0) > 0.28) return null;
    if (results[1] && (results[1].score ?? 1) - (results[0].score ?? 0) < 0.04)
      return { ambiguous: true, fields: results.map((result) => result.item.field).filter((f): f is CatalogField => !!f) };
    return { field: results[0].item.field };
  }
}

export class SemanticFieldMatchStrategy {
  semanticMatcher: SemanticFieldMatcher;
  catalog: () => CatalogField[];

  constructor({ semanticMatcher, catalog }: { semanticMatcher: SemanticFieldMatcher; catalog: () => CatalogField[] }) {
    this.semanticMatcher = semanticMatcher;
    this.catalog = catalog;
  }

  async matchPhrase(phrase, roles) {
    return this.semanticMatcher.matchField(norm(phrase), roles, this.catalog());
  }

  async findInText(text, role) {
    const result = await this.semanticMatcher.matchField(text, [role], this.catalog());
    return result?.ambiguous ? null : result?.field || null;
  }
}

export class FieldResolver {
  strategies: Array<{ matchPhrase?: (phrase: string, roles: FieldRole[]) => Promise<unknown>; findInText?: (text: string, role: FieldRole) => Promise<CatalogField | null> }>;
  clarify: (pending: Record<string, unknown>, message: string, fields: CatalogField[]) => { field?: CatalogField; clarification?: unknown };

  constructor(
    strategies: FieldResolver['strategies'],
    clarify: FieldResolver['clarify'],
  ) {
    this.strategies = strategies;
    this.clarify = clarify;
  }

  async resolvePhrase(phrase, roles, clarification: Record<string, unknown> | null = null) {
    if (!norm(phrase)) return { field: undefined };
    for (const strategy of this.strategies) {
      const raw = await strategy.matchPhrase?.(phrase, roles);
      if (!raw) continue;
      const result = raw as { field?: CatalogField | null; ambiguous?: boolean; fields?: CatalogField[]; score?: number };
      if (result.ambiguous) {
        const fields = result.fields || [];
        const clarified =
          clarification?.slot === 'field' && norm(clarification.phrase as string) === norm(phrase)
            ? fields.find((field) => field.id === clarification.fieldId)
            : null;
        if (clarified) return { field: clarified };
        return this.clarify(
          { slot: 'field', phrase, roles },
          `Which field did you mean by "${phrase}"?`,
          fields,
        );
      }
      if (result.field) return { field: result.field };
    }
    return { field: undefined };
  }

  async findInText(text, role) {
    for (const strategy of this.strategies) {
      const field = await strategy.findInText?.(text, role);
      if (field) return field;
    }
    return null;
  }
}

export class SqlPlanner {
  config: { dataSources?: Array<{ name: string }>; relationships?: Relationship[] };
  askConfig: { maxRows?: number; maxDimensions?: number; validation?: { joinFanoutRatio?: number; joinFanoutMinExtraRows?: number; filterSelectivityRatio?: number } };
  relationships: () => Relationship[];
  getDefaultTimeField: () => CatalogField | undefined;

  constructor({ config, askConfig, relationships, getDefaultTimeField }: {
    config: SqlPlanner['config'];
    askConfig?: SqlPlanner['askConfig'];
    relationships: SqlPlanner['relationships'];
    getDefaultTimeField: SqlPlanner['getDefaultTimeField'];
  }) {
    this.config = config;
    this.askConfig = askConfig || {};
    this.relationships = relationships;
    this.getDefaultTimeField = getDefaultTimeField;
  }

  timeSqlExpression(field, alias) {
    const isNativeDate = /date|timestamp|time/i.test(field.type || '');
    if (isNativeDate) return `${alias}.${quoteIdent(field.column)}`;
    return field.parseFormat
      ? `STRPTIME(CAST(${alias}.${quoteIdent(field.column)} AS VARCHAR), '${field.parseFormat}')`
      : `TRY_CAST(${alias}.${quoteIdent(field.column)} AS DATE)`;
  }

  plan(intent): import('./types').PlannedSql {
    const fields = [
      intent.metric?.field || intent.metric,
      intent.timeField,
      ...intent.dimensions,
      ...intent.filters.map((f) => f.field),
      intent.dateRange?.field,
    ].filter((f) => f && f.table);
    const baseTable =
      intent.metric?.field?.table ||
      intent.metric?.table ||
      fields[0]?.table ||
      this.config.dataSources?.[0]?.name;
    const neededTables = [...new Set([baseTable, ...fields.map((f) => f.table)])];
    const joinPlan = this.buildJoinPlan(baseTable, neededTables) as { error?: string; tables: string[]; joins: Relationship[] };
    if (joinPlan.error) return { error: joinPlan.error };

    const aliases = new Map(joinPlan.tables.map((table, i) => [table, safeAlias(table, i)]));
    const selectParts: string[] = [];
    const groupParts: string[] = [];
    for (const dim of intent.dimensions) {
      const alias = aliases.get(dim.table);
      let expr;
      if (dim.role === 'time') {
        expr = `DATE_TRUNC('${intent.timeGrain || 'month'}', ${this.timeSqlExpression(dim, alias)})`;
      } else {
        expr = `${alias}.${quoteIdent(dim.column)}`;
      }
      const dimAlias = `d${selectParts.length + 1}`;
      selectParts.push(`${expr} AS ${quoteIdent(dimAlias)}`);
      groupParts.push(expr);
    }

    const { metricExpr, metricFormat } = this.buildMetricExpr(intent, aliases);
    const whereParts = this.buildWhereParts(intent, aliases);
    const from = `${quoteIdent(baseTable)} ${aliases.get(baseTable)}`;
    const joins = joinPlan.joins.map((rel) => {
      const leftAlias = aliases.get(rel.left.table);
      const rightAlias = aliases.get(rel.right.table);
      const joinTable = rel.right.table;
      return `JOIN ${quoteIdent(joinTable)} ${rightAlias} ON ${leftAlias}.${quoteIdent(rel.left.column)} = ${rightAlias}.${quoteIdent(rel.right.column)}`;
    });

    const diagnostics = this.buildDiagnostics({
      intent,
      baseTable,
      aliases,
      from,
      joinSqls: joins,
      joinRels: joinPlan.joins,
      whereParts,
    });

    if (intent.analysisType === 'list_values')
      return this.planListValues(intent, aliases, whereParts, from, joins, diagnostics);
    if (intent.analysisType === 'yoy')
      return this.planYoY(intent, aliases, metricExpr, whereParts, from, joins, diagnostics);
    if (intent.analysisType === 'change')
      return this.planChange(intent, aliases, metricExpr, metricFormat, whereParts, from, joins, diagnostics);
    if (intent.analysisType === 'share')
      return this.planShare(intent, selectParts, groupParts, metricExpr, metricFormat, whereParts, from, joins, diagnostics);
    return this.planGrouped(intent, selectParts, groupParts, metricExpr, metricFormat, whereParts, from, joins, diagnostics);
  }

  buildMetricExpr(intent, aliases) {
    let metricExpr: string | null = null;
    let metricFormat: string | undefined;
    if (intent.metric?.kind === 'count_star') {
      metricExpr = 'COUNT(*)';
    } else if (intent.metric?.kind === 'count_distinct') {
      const f = intent.metric.field;
      metricExpr = `COUNT(DISTINCT ${aliases.get(f.table)}.${quoteIdent(f.column)})`;
    } else if (intent.analysisType !== 'list_values' && intent.metric) {
      const m = intent.metric;
      metricFormat = m.format;
      metricExpr = `${m.aggregation || 'SUM'}(${aliases.get(m.table)}.${quoteIdent(m.column)})`;
    }
    return { metricExpr, metricFormat };
  }

  buildWhereParts(intent, aliases) {
    const whereParts = intent.filters.map((filter) => {
      const expr = `${aliases.get(filter.field.table)}.${quoteIdent(filter.field.column)}`;
      if (filter.operator === 'IN') {
        const inList = (filter.values || []).map((value) => `'${escapeSqlString(value)}'`).join(', ');
        return `${expr} IN (${inList})`;
      }
      return `${expr} = '${escapeSqlString(filter.value)}'`;
    });
    if (intent.dateRange?.field) {
      const field = intent.dateRange.field;
      const dateExpr = this.timeSqlExpression(field, aliases.get(field.table));
      if (intent.dateRange.kind === 'monthOfYear') {
        whereParts.push(`EXTRACT(month FROM ${dateExpr}) = ${Number(intent.dateRange.month)}`);
      } else {
        whereParts.push(`${dateExpr} >= DATE '${intent.dateRange.start}'`);
        whereParts.push(`${dateExpr} < DATE '${intent.dateRange.end}'`);
      }
    }
    return whereParts;
  }

  planListValues(intent, aliases, whereParts, from, joins, diagnostics) {
    const dim = intent.dimensions[0];
    const expr = `${aliases.get(dim.table)}.${quoteIdent(dim.column)}`;
    const listWhereParts = [
      ...whereParts,
      `${expr} IS NOT NULL`,
      `CAST(${expr} AS VARCHAR) <> ''`,
    ];
    const sql = `SELECT DISTINCT ${expr} AS label\nFROM ${from}\n${joins.join('\n')}\nWHERE ${listWhereParts.join(' AND ')}\nORDER BY label ASC\nLIMIT ${Number(intent.limit) || this.askConfig.maxRows || 25}`;
    return { sql, columns: ['label'], diagnostics };
  }

  planYoY(intent, aliases, metricExpr, whereParts, from, joins, diagnostics) {
    const timeField =
      intent.timeField ||
      intent.dimensions.find((d) => d.role === 'time') ||
      this.getDefaultTimeField();
    if (!timeField)
      return { error: 'I could not find a date/time field for year-over-year analysis.' };
    const periodExpr = `DATE_TRUNC('year', ${this.timeSqlExpression(timeField, aliases.get(timeField.table))})`;
    const yoyJoins = joins.length ? `\n  ${joins.join('\n  ')}` : '';
    const yoyWhere = whereParts.length ? `\n  WHERE ${whereParts.join(' AND ')}` : '';
    const sql = `WITH yearly AS (\n  SELECT ${periodExpr} AS period, ${metricExpr} AS value\n  FROM ${from}${yoyJoins}${yoyWhere}\n  GROUP BY 1\n), yoy AS (\n  SELECT period, value, LAG(value) OVER (ORDER BY period) AS previous_value\n  FROM yearly\n)\nSELECT CAST(period AS VARCHAR) AS period, value, previous_value, value - previous_value AS change, CASE WHEN previous_value IS NULL OR previous_value = 0 THEN NULL ELSE (value - previous_value) / previous_value END AS change_percent\nFROM yoy\nORDER BY period ASC`;
    return { sql, columns: ['period', 'value', 'previous_value', 'change', 'change_percent'], diagnostics };
  }

  planChange(intent, aliases, metricExpr, metricFormat, whereParts, from, joins, diagnostics) {
    const timeField = intent.timeField || this.getDefaultTimeField();
    if (!timeField) return { error: 'I could not find a date/time field for change analysis.' };
    const dateExpr = this.timeSqlExpression(timeField, aliases.get(timeField.table));
    const startYear = Number(intent.change.startYear);
    const endYear = Number(intent.change.endYear);
    const changeWhere = [...whereParts, `EXTRACT(year FROM ${dateExpr}) IN (${startYear}, ${endYear})`];
    const changeJoins = joins.length ? `\n  ${joins.join('\n  ')}` : '';
    const changeWhereClause = changeWhere.length ? `\n  WHERE ${changeWhere.join(' AND ')}` : '';
    const sql = `WITH yearly AS (\n  SELECT EXTRACT(year FROM ${dateExpr}) AS year, ${metricExpr} AS value\n  FROM ${from}${changeJoins}${changeWhereClause}\n  GROUP BY 1\n), picked AS (\n  SELECT SUM(CASE WHEN year = ${startYear} THEN value END) AS start_value, SUM(CASE WHEN year = ${endYear} THEN value END) AS end_value\n  FROM yearly\n)\nSELECT '${startYear} to ${endYear}' AS period, start_value, end_value, end_value - start_value AS change, CASE WHEN start_value IS NULL OR start_value = 0 THEN NULL ELSE (end_value - start_value) / start_value END AS change_percent\nFROM picked`;
    return { sql, columns: ['period', 'start_value', 'end_value', 'change', 'change_percent'], diagnostics, metricFormat };
  }

  planShare(intent, selectParts, groupParts, metricExpr, metricFormat, whereParts, from, joins, diagnostics) {
    if (!intent.dimensions.length)
      return { error: 'I need a dimension to calculate share of total.' };
    const shareInnerSelect = [...selectParts, `${metricExpr} AS value`].join(',\n  ');
    const shareJoinsClause = joins.length ? `\n${joins.join('\n')}` : '';
    const shareWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
    const shareInner = `SELECT\n  ${shareInnerSelect}\nFROM ${from}${shareJoinsClause}${shareWhereClause}\nGROUP BY ${groupParts.map((_, i) => i + 1).join(', ')}`;
    const shareLabelExpr =
      intent.dimensions.length === 1
        ? `CAST(d1 AS VARCHAR)`
        : intent.dimensions.map((_, i) => `CAST(d${i + 1} AS VARCHAR)`).join(` || ' / ' || `);
    const shareValues = (intent.shareValues || []).map((value) => `'${escapeSqlString(value)}'`).join(', ');
    const shareFilterClause = shareValues ? `\nWHERE label IN (${shareValues})` : '';
    const sql = `WITH grouped AS (\n${shareInner}\n), shares AS (\n  SELECT ${shareLabelExpr} AS label, value, CASE WHEN SUM(value) OVER () = 0 THEN NULL ELSE value / SUM(value) OVER () END AS share\n  FROM grouped\n)\nSELECT label, value, share\nFROM shares${shareFilterClause}\nORDER BY value ${intent.sort?.direction || 'DESC'}\nLIMIT ${Number(intent.limit) || this.askConfig.maxRows || 25}`;
    return { sql, columns: ['label', 'value', 'share'], metricFormat, diagnostics };
  }

  planGrouped(intent, selectParts, groupParts, metricExpr, metricFormat, whereParts, from, joins, diagnostics) {
    let sql: string;
    if (intent.dimensions.length) {
      const groupedInnerSelect = [...selectParts, `${metricExpr} AS value`].join(',\n  ');
      const groupedJoinsClause = joins.length ? `\n${joins.join('\n')}` : '';
      const groupedWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      const groupedInner = `SELECT\n  ${groupedInnerSelect}\nFROM ${from}${groupedJoinsClause}${groupedWhereClause}\nGROUP BY ${groupParts.map((_, i) => i + 1).join(', ')}`;
      const groupedLabelExpr =
        intent.dimensions.length === 1
          ? `CAST(d1 AS VARCHAR)`
          : intent.dimensions.map((_, i) => `CAST(d${i + 1} AS VARCHAR)`).join(` || ' / ' || `);
      const orderBy =
        intent.dimensions[0]?.role === 'time'
          ? 'label ASC'
          : `value ${intent.sort?.direction || 'DESC'}`;
      sql = `SELECT ${groupedLabelExpr} AS label, value\nFROM (\n${groupedInner}\n) q\nORDER BY ${orderBy}\nLIMIT ${Number(intent.limit) || this.askConfig.maxRows || 25}`;
    } else {
      const simpleJoinsClause = joins.length ? `\n${joins.join('\n')}` : '';
      const simpleWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      sql = `SELECT ${metricExpr} AS value\nFROM ${from}${simpleJoinsClause}${simpleWhereClause}`;
    }
    return {
      sql,
      columns: intent.dimensions.length ? ['label', 'value'] : ['value'],
      metricFormat,
      diagnostics,
    };
  }

  buildDiagnostics({ intent, baseTable, aliases, from, joinSqls, joinRels, whereParts }) {
    const joinsSuffix = joinSqls.length ? `\n${joinSqls.join('\n')}` : '';
    const joinedFrom = `${from}${joinsSuffix}`;
    const diagnostics: Diagnostics = {};
    if (joinSqls.length) {
      const baseAlias = aliases.get(baseTable);
      const baseWhereParts = whereParts.filter((part) => part.includes(`${baseAlias}.`));
      const baseWhereClause = baseWhereParts.length ? `\nWHERE ${baseWhereParts.join(' AND ')}` : '';
      const joinedWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      const baseSql = `SELECT COUNT(*) AS row_count FROM ${from}${baseWhereClause}`;
      const joinedSql = `SELECT COUNT(*) AS row_count FROM ${joinedFrom}${joinedWhereClause}`;
      diagnostics.joinFanout = {
        baseTable,
        joinedTables: [...new Set(joinRels.map((rel) => rel.right.table))] as string[],
        baseCountSql: baseSql,
        joinedCountSql: joinedSql,
        threshold: this.askConfig.validation?.joinFanoutRatio || 1.5,
        minExtraRows: this.askConfig.validation?.joinFanoutMinExtraRows || 100,
      };
    }
    if (whereParts.length) {
      diagnostics.filterSelectivity = {
        unfilteredCountSql: `SELECT COUNT(*) AS row_count FROM ${joinedFrom}`,
        filteredCountSql: `SELECT COUNT(*) AS row_count FROM ${joinedFrom}\nWHERE ${whereParts.join(' AND ')}`,
        threshold: this.askConfig.validation?.filterSelectivityRatio || 0.1,
      };
    }
    const timeField =
      intent.timeField ||
      intent.dimensions?.find((field) => field.role === 'time') ||
      intent.dateRange?.field;
    if (timeField) {
      const alias = aliases.get(timeField.table);
      const rawExpr = `${alias}.${quoteIdent(timeField.column)}`;
      const isNativeDate = /date|timestamp|time/i.test(timeField.type || '');
      const tryExpr =
        !isNativeDate && timeField.parseFormat
          ? `TRY_STRPTIME(CAST(${rawExpr} AS VARCHAR), '${timeField.parseFormat}')`
          : `TRY_CAST(${rawExpr} AS DATE)`;
      const dateParseWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      diagnostics.dateParse = {
        field: timeField.label || timeField.column,
        sql: `SELECT COUNT(*) AS checked_rows, SUM(CASE WHEN ${rawExpr} IS NOT NULL AND ${tryExpr} IS NULL THEN 1 ELSE 0 END) AS dropped_rows FROM ${joinedFrom}${dateParseWhereClause}`,
      };
    }
    return Object.keys(diagnostics).length ? diagnostics : null;
  }

  buildJoinPlan(baseTable, neededTables) {
    const tables: string[] = [baseTable];
    const joins: Relationship[] = [];
    for (const table of neededTables) {
      if (tables.includes(table)) continue;
      const path = this.findRelationshipPath(tables, table);
      if (!path)
        return {
          error: `I do not know how to join ${baseTable} to ${table}. Add a relationship or confirm an inferred join.`,
        };
      for (const rel of path) {
        const leftKnown = tables.includes(rel.left.table);
        const rightKnown = tables.includes(rel.right.table);
        if (leftKnown && !rightKnown) {
          joins.push(rel);
          tables.push(rel.right.table);
        } else if (rightKnown && !leftKnown) {
          joins.push({
            left: rel.right,
            right: rel.left,
            confidence: rel.confidence,
            inferred: rel.inferred,
          });
          tables.push(rel.left.table);
        }
      }
    }
    return { tables, joins };
  }

  findRelationshipPath(startTables: string[], targetTable: string) {
    const queue: { table: string; path: Relationship[] }[] = startTables.map((table) => ({ table, path: [] }));
    const visited = new Set(startTables);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.table === targetTable) return current.path;
      for (const rel of this.relationships()) {
        let next: string | null = null;
        if (rel.left.table === current.table) next = rel.right.table;
        else if (rel.right.table === current.table) next = rel.left.table;
        if (!next || visited.has(next)) continue;
        visited.add(next);
        queue.push({ table: next, path: [...current.path, rel] });
      }
    }
    return null;
  }
}

export class ValueFilterResolver {
  valueItems: () => ValueItem[];
  valueFuse: () => ValueFuse | null;
  valuePhraseMaxWords: () => number;
  displayLabel: (field: CatalogField) => string;
  localizedTerms: (field: CatalogField) => string[];

  constructor({ valueItems, valueFuse, valuePhraseMaxWords, displayLabel, localizedTerms }: {
    valueItems: () => ValueItem[];
    valueFuse: () => ValueFuse | null;
    valuePhraseMaxWords: () => number;
    displayLabel: (field: CatalogField) => string;
    localizedTerms: (field: CatalogField) => string[];
  }) {
    this.valueItems = valueItems;
    this.valueFuse = valueFuse;
    this.valuePhraseMaxWords = valuePhraseMaxWords;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
  }

  resolve(q, clarification: Record<string, unknown> | null = null) {
    const matches = this.findMatches(q);
    const byValue = new Map<string, ValueItem[]>();
    for (const match of matches.sort(
      (a, b) => b.normalizedValue.length - a.normalizedValue.length,
    )) {
      if ([...byValue.keys()].some((v) => v.includes(match.normalizedValue))) continue;
      if (!byValue.has(match.normalizedValue)) byValue.set(match.normalizedValue, []);
      const bucket = byValue.get(match.normalizedValue);
      if (bucket) bucket.push(match);
    }
    return this.toFilters(q, byValue, clarification);
  }

  findMatches(q) {
    const matches: ValueItem[] = [];
    const seen = new Set<string>();
    const addMatch = (item: ValueItem, matchScore = 1, matchSource = 'exact') => {
      const key = `${item.field.id}::${item.normalizedValue}`;
      const enriched = { ...item, matchScore, matchSource };
      if (!seen.has(key)) {
        seen.add(key);
        matches.push(enriched);
      } else {
        const existing = matches.find((m) => `${m.field.id}::${m.normalizedValue}` === key) as ValueItem & { matchScore?: number };
        if (existing && matchScore > (existing.matchScore || 0))
          Object.assign(existing, enriched);
      }
    };
    for (const item of this.valueItems()) {
      const v = item.normalizedValue;
      if (!v || v.length < 2) continue;
      const pattern = `\\b${escapeRegExp(v).replace(/\s+/g, '\\s+')}\\b`;
      if (new RegExp(pattern).test(q)) addMatch(item, 1, 'exact_value');
    }
    const fuse = this.valueFuse();
    if (fuse) this.addFuseMatches(q, fuse, addMatch);
    return matches;
  }

  addFusePhrase(phrase: string, size: number, fuse: ValueFuse, addMatch: (item: ValueItem, score: number, source: string) => void) {
    if (phrase.length < 4) return;
    for (const result of fuse.search(phrase, { limit: 3 })) {
      const itemWordCount = result.item.normalizedValue.split(/\s+/).length;
      if (itemWordCount !== size) continue;
      const fuzzyLimit = itemWordCount > 1 ? 0.025 : 0.001;
      if ((result.score ?? 1) <= fuzzyLimit)
        addMatch(result.item, Math.max(0.75, 1 - (result.score || 0) * 10), 'fuzzy_value');
    }
  }

  addFuseMatches(q: string, fuse: ValueFuse, addMatch: (item: ValueItem, score: number, source: string) => void) {
    const words = q.split(/\s+/).filter(Boolean);
    const maxWindow = Math.min(this.valuePhraseMaxWords() || 1, 8, words.length);
    for (let size = 1; size <= maxWindow; size++) {
      for (let start = 0; start + size <= words.length; start++) {
        const phrase = words.slice(start, start + size).join(' ');
        this.addFusePhrase(phrase, size, fuse, addMatch);
      }
    }
  }

  resolveAmbiguousField(q, items, uniqueFields, clarification) {
    const clarified =
      clarification?.slot === 'filterField' &&
      clarification.valueNormalized === items[0].normalizedValue
        ? uniqueFields.find((i) => i.field.id === clarification.fieldId)
        : null;
    const cueHasFieldName =
      clarified ||
      uniqueFields.find((i) =>
        [this.displayLabel(i.field), i.field.label, i.field.column, ...this.localizedTerms(i.field)]
          .map(norm)
          .some((term) => term && q.includes(term)),
      );
    return { clarified, cueHasFieldName };
  }

  toFilters(q, byValue: Map<string, ValueItem[]>, clarification: Record<string, unknown> | null = null) {
    const filters: IntentFilter[] = [];
    for (const [, items] of byValue) {
      const uniqueFields = [
        ...new Map(items.map((i) => [i.field.id, i])).values(),
      ];
      if (uniqueFields.length > 1) {
        const { clarified, cueHasFieldName } = this.resolveAmbiguousField(q, items, uniqueFields, clarification);
        if (cueHasFieldName) {
          filters.push({
            field: cueHasFieldName.field,
            operator: '=',
            value: cueHasFieldName.value,
            score: cueHasFieldName.matchScore || 0.9,
            source: clarified ? 'clarification' : cueHasFieldName.matchSource,
          });
        } else {
          const candidates = uniqueFields.slice(0, 5).map((i) => ({
            label: `${i.field.label} = ${i.value}`,
            fieldId: i.field.id,
            fieldLabel: i.field.label,
            table: i.field.table,
            column: i.field.column,
            value: i.value,
            valueNormalized: i.normalizedValue,
          }));
          return {
            clarification: {
              message: `Which field should "${items[0].value}" filter?`,
              pending: {
                slot: 'filterField',
                originalQuestion: null,
                value: items[0].value,
                valueNormalized: items[0].normalizedValue,
                candidates,
              },
              choices: candidates,
            },
          };
        }
      } else {
        const item = uniqueFields[0];
        filters.push({
          field: item.field,
          operator: '=',
          value: item.value,
          score: (item as ValueItem & { matchScore?: number }).matchScore || 0.9,
          source: (item as ValueItem & { matchSource?: string }).matchSource,
        });
      }
    }
    return { filters };
  }
}

export class QuestionParser {
  askConfig: { maxRows?: number; maxDimensions?: number };
  catalog: () => CatalogField[];
  entities: () => Entity[];
  termMatcher: TermMatcher;
  intentCues: IntentCueDetector;
  filterResolver: ValueFilterResolver;
  dateRangeParser: DateRangeParser;
  localizedTerms: (field: CatalogField) => string[];
  resolveFieldPhrase: (phrase: string, roles: FieldRole[], clarification: unknown) => Promise<{ field?: CatalogField; clarification?: unknown }>;
  findBestFieldInText: (text: string, role: FieldRole) => Promise<CatalogField | null>;
  getDefaultMetric: () => IntentMetric;
  getDefaultTimeField: () => CatalogField | undefined;

  constructor({
    askConfig,
    catalog,
    entities,
    termMatcher,
    intentCues,
    filterResolver,
    dateRangeParser,
    localizedTerms,
    resolveFieldPhrase,
    findBestFieldInText,
    getDefaultMetric,
    getDefaultTimeField,
  }: {
    askConfig?: QuestionParser['askConfig'];
    catalog: QuestionParser['catalog'];
    entities: QuestionParser['entities'];
    termMatcher: TermMatcher;
    intentCues: IntentCueDetector;
    filterResolver: ValueFilterResolver;
    dateRangeParser: DateRangeParser;
    localizedTerms: (field: CatalogField) => string[];
    resolveFieldPhrase: QuestionParser['resolveFieldPhrase'];
    findBestFieldInText: QuestionParser['findBestFieldInText'];
    getDefaultMetric: QuestionParser['getDefaultMetric'];
    getDefaultTimeField: QuestionParser['getDefaultTimeField'];
  }) {
    this.askConfig = askConfig || {};
    this.catalog = catalog;
    this.entities = entities;
    this.termMatcher = termMatcher;
    this.intentCues = intentCues;
    this.filterResolver = filterResolver;
    this.dateRangeParser = dateRangeParser;
    this.localizedTerms = localizedTerms;
    this.resolveFieldPhrase = resolveFieldPhrase;
    this.findBestFieldInText = findBestFieldInText;
    this.getDefaultMetric = getDefaultMetric;
    this.getDefaultTimeField = getDefaultTimeField;
  }

  async parse(question, options: Record<string, unknown> = {}) {
    const dateInfo = this.dateRangeParser.parse(question, this.getDefaultTimeField());
    const fullQ = norm(question);
    const q = norm(dateInfo.questionWithoutDate || question);
    const warnings: string[] = [];
    if (!q) return { error: 'Ask a question first.' };

    const unsupportedMetric = this.detectUnsupportedMetric(q);
    if (unsupportedMetric) return this.unsupportedMetricError(question, unsupportedMetric);

    const listField = await this.detectListField(q, options);
    if (listField) return this.listIntent(question, q, dateInfo, listField, warnings, options);

    return this.resolveIntent(question, fullQ, q, dateInfo, warnings, options);
  }

  async resolveIntent(question, fullQ, q, dateInfo, warnings, options) {
    const topOrBottom = [this.termAlternation('top'), this.termAlternation('bottom')]
      .filter(Boolean)
      .join('|');
    const topMatch = topOrBottom ? q.match(new RegExp(`\\b(${topOrBottom})\\s+(\\d+)\\b`)) : null;
    const superlative = await this.detectSuperlative(q, options);
    let limit: number;
    if (superlative) limit = 1;
    else if (topMatch) limit = Math.min(Number(topMatch[2]), this.askConfig.maxRows || 25);
    else limit = this.askConfig.maxRows || 25;
    let sortDirection = superlative?.direction || 'DESC';
    if (!superlative && topMatch && this.terms('bottom').includes(norm(topMatch[1])))
      sortDirection = 'ASC';
    const isRanking = !!topMatch || !!superlative;
    const isYoY = this.intentCues.isYearOverYear(q);
    const timeGrain = isYoY ? 'year' : this.intentCues.timeGrain(q);
    const isCount = this.hasTerm(q, 'count');
    const metric = await this.resolveMetric(q, isCount, superlative);
    const change = this.detectChange(fullQ);
    if (change) {
      const filters = this.filterResolver.resolve(q, options.clarification);
      if (filters.clarification) return this.withOriginalQuestion(filters, question);
      return {
        intent: {
          question,
          analysisType: 'change',
          metric,
          timeField: this.getDefaultTimeField(),
          dimensions: [],
          filters: filters.filters,
          dateRange: null,
          change,
          sort: { by: 'period', direction: 'ASC' },
          limit: 1,
        },
        warnings,
      };
    }
    return this.buildIntentResult(question, q, fullQ, dateInfo, warnings, options, {
      metric, limit, sortDirection, isRanking, isYoY, timeGrain, isCount, superlative,
    });
  }

  async buildIntentResult(question, q, fullQ, dateInfo, warnings, options: Record<string, unknown>, resolved) {
    const { metric, limit, sortDirection, isRanking, isYoY, timeGrain, isCount, superlative } = resolved;
    const dimensionsResult = await this.resolveDimensions(q, superlative, timeGrain, isCount, warnings, options);
    if (!Array.isArray(dimensionsResult)) return this.withOriginalQuestion(dimensionsResult, question);
    const dimensions = dimensionsResult as CatalogField[];
    const filters = this.filterResolver.resolve(q, (options.clarification as Record<string, unknown> | null) ?? null);
    if (filters.clarification) return this.withOriginalQuestion(filters, question);
    const share = this.buildShare(fullQ, filters.filters, dimensions);
    const comparison = share ? null : this.buildComparison(q, filters.filters, dimensions);
    const finalDimensions = share?.dimensions || comparison?.dimensions || dimensions;
    const finalFilters = share?.filters || comparison?.filters || filters.filters;

    let analysisType: import('./types').AnalysisType = 'kpi';
    if (share) analysisType = 'share';
    else if (comparison) analysisType = 'comparison';
    else if (isYoY) analysisType = 'yoy';
    else if (finalDimensions.some((d) => d.role === 'time')) analysisType = 'trend';
    else if (isRanking || finalDimensions.length) analysisType = 'ranking';

    return {
      intent: {
        question,
        analysisType,
        metric,
        timeField: isYoY ? this.getDefaultTimeField() : null,
        dimensions: finalDimensions.slice(0, this.askConfig.maxDimensions || 2),
        filters: finalFilters,
        dateRange: dateInfo.dateRange,
        shareValues: share?.values,
        sort: { by: 'value', direction: sortDirection },
        limit: comparison ? Math.max(limit, comparison.values.length) : limit,
        timeGrain: timeGrain || (finalDimensions.some((d) => d.role === 'time') ? 'month' : undefined),
      },
      warnings,
    };
  }

  unsupportedMetricError(question, unsupportedMetric) {
    const measures = this.catalog().filter((f) => f.role === 'measure');
    const available = measures.map((f) => f.label).join(', ') || 'none';
    return {
      error: `I could not find a "${unsupportedMetric}" metric in this dataset. Available measures: ${available}.`,
      suggestions: measures
        .slice(0, 4)
        .map((f) => question.replace(new RegExp(unsupportedMetric, 'ig'), f.label.toLowerCase())),
    };
  }

  listIntent(question, q, dateInfo, listField, warnings, options: Record<string, unknown> = {}) {
    const filters = this.filterResolver.resolve(q, (options.clarification as Record<string, unknown> | null) ?? null);
    if (filters.clarification) return this.withOriginalQuestion(filters, question);
    return {
      intent: {
        question,
        analysisType: 'list_values',
        metric: null,
        dimensions: [listField],
        filters: filters.filters,
        dateRange: dateInfo.dateRange,
        sort: { by: 'label', direction: 'ASC' },
        limit: this.askConfig.maxRows || 25,
      },
      warnings,
    };
  }

  async resolveMetric(q, isCount, superlative) {
    if (!isCount)
      return (
        superlative?.metric ||
        (await this.findBestFieldInText(q, 'measure')) ||
        this.getDefaultMetric()
      );
    const countEntity = this.entities().find((entity) =>
      entity.terms.some((term) => this.termMatcher.patternFromTerm(term)?.test(q)),
    );
    return countEntity
      ? {
          kind: 'count_distinct',
          entity: countEntity,
          field: countEntity.field,
          label: countEntity.label,
        }
      : { kind: 'count_star', label: 'Records' };
  }

  detectChange(q) {
    if (!this.hasTerm(q, 'change')) return null;
    const explicitYears = [...q.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) =>
      Number(match[1]),
    );
    if (explicitYears.length >= 2)
      return { startYear: explicitYears[0], endYear: explicitYears[1] };
    if (this.hasTerm(q, 'latestYear')) {
      const maxDate = this.getDefaultTimeField()?.dateProfile?.maxDate;
      const maxYear = maxDate ? new Date(`${maxDate}T00:00:00Z`).getUTCFullYear() : null;
      if (maxYear) return { startYear: maxYear - 1, endYear: maxYear };
    }
    return null;
  }

  buildShare(q, filters, dimensions) {
    if (!this.hasTerm(q, 'share')) return null;
    if (dimensions.length) return { dimensions, filters, values: null };
    const contributionFilter = (filters || []).find(
      (filter) => !filter.operator || filter.operator === '=',
    );
    if (!contributionFilter) return null;
    return {
      dimensions: [contributionFilter.field],
      filters: filters.filter((filter) => filter !== contributionFilter),
      values: [contributionFilter.value],
    };
  }

  buildComparison(q, filters, dimensions) {
    if (!this.hasTerm(q, 'comparison')) return null;
    const groups = new Map();
    for (const filter of filters || []) {
      if (filter.operator && filter.operator !== '=') continue;
      const key = filter.field.id;
      if (!groups.has(key)) groups.set(key, { field: filter.field, filters: [] });
      groups.get(key).filters.push(filter);
    }
    const group = [...groups.values()].find((item) => item.filters.length >= 2);
    if (!group) return null;
    const values = [...new Set(group.filters.map((filter) => filter.value))];
    const comparisonFilter = {
      field: group.field,
      operator: 'IN',
      values,
      score: Math.min(...group.filters.map((filter) => filter.score || 0.9)),
      source: 'comparison_values',
    };
    const remainingFilters = filters.filter((filter) => filter.field.id !== group.field.id);
    const comparisonDimension = dimensions.some((dimension) => dimension.id === group.field.id)
      ? []
      : [group.field];
    return {
      values,
      dimensions: [...comparisonDimension, ...dimensions],
      filters: [...remainingFilters, comparisonFilter],
    };
  }

  withOriginalQuestion(result, question) {
    if (result.clarification?.pending) result.clarification.pending.originalQuestion = question;
    return result;
  }

  async resolveTimeDimension(q, timeGrain, dimensions, warnings) {
    if ((timeGrain || this.hasTerm(q, 'overTime')) && !dimensions.some((d) => d.role === 'time')) {
      const timeField = this.getDefaultTimeField();
      if (timeField) dimensions.unshift(timeField);
      else warnings.push('I could not find a date/time field for a trend.');
    }
  }

  async resolveByPhrases(q: string, byPhrases: string[], dimensions: CatalogField[], options: Record<string, unknown>): Promise<{ field?: CatalogField; clarification?: unknown } | null> {
    for (const phrase of byPhrases) {
      if (dimensions.length >= (this.askConfig.maxDimensions || 2)) break;
      if (['month', 'year', 'day', 'date', 'time'].includes(phrase) || /over time/.test(q))
        continue;
      const field = await this.resolveFieldPhrase(phrase, ['dimension', 'time'], options.clarification);
      if (field.clarification) return field;
      if (field.field && !dimensions.some((d) => d.id === (field.field as CatalogField).id))
        dimensions.push(field.field as CatalogField);
    }
    return null;
  }

  async resolveDimensions(q: string, superlative: { field?: CatalogField } | null, timeGrain: string | null, isCount: boolean, warnings: string[], options: Record<string, unknown> = {}): Promise<CatalogField[] | { field?: CatalogField; clarification?: unknown }> {
    const dimensions: CatalogField[] = [];
    const topDimensionPhrase = superlative?.field ? null : this.extractTopDimensionPhrase(q);
    if (superlative?.field) dimensions.push(superlative.field);
    const byPhrases = this.extractByPhrases(q);
    if (topDimensionPhrase) {
      const field = await this.resolveFieldPhrase(topDimensionPhrase, ['dimension', 'time'], options.clarification);
      if (field.clarification) return field;
      if (field.field) dimensions.push(field.field);
    }
    const byResult = await this.resolveByPhrases(q, byPhrases, dimensions, options);
    if (byResult?.clarification) return byResult;
    await this.resolveTimeDimension(q, timeGrain, dimensions, warnings);
    if (!dimensions.length && isCount) {
      const byAfterCount = byPhrases[0];
      if (byAfterCount) {
        const field = await this.resolveFieldPhrase(byAfterCount, ['dimension', 'time'], options.clarification);
        if (field.field) dimensions.push(field.field);
      }
    }
    return dimensions;
  }

  async detectListField(q, options: Record<string, unknown> = {}) {
    if (!this.intentCues.isListRequest(q)) return null;
    if (await this.findBestFieldInText(q, 'measure')) return null;
    const hintedField = this.intentCues.listFieldHint(q);
    if (hintedField)
      return (await this.resolveFieldPhrase(hintedField, ['dimension'], options.clarification))
        .field;
    const entity = this.entities().find((e) =>
      e.terms.some((term) => this.termMatcher.patternFromTerm(term)?.test(q)),
    );
    if (this.hasTerm(q, 'listKind') && entity?.preferredDimensionFields?.length)
      return entity.preferredDimensionFields[0];
    if (entity)
      return (
        entity.preferredDimensionFields?.find((f) => /name|nome/i.test(f.column)) ||
        entity.preferredDimensionFields?.[0]
      );
    const phrase = this.intentCues.extractListPhrase(q);
    return phrase
      ? (await this.resolveFieldPhrase(phrase, ['dimension'], options.clarification)).field
      : null;
  }

  async detectSuperlative(q, options: Record<string, unknown> = {}) {
    const direction = this.intentCues.superlativeDirection(q);
    if (!direction) return null;
    const phrase = this.intentCues.extractSuperlativeSubject(q);
    if (!phrase) return null;
    const field = (await this.resolveFieldPhrase(phrase, ['dimension'], options.clarification))
      .field;
    if (!field) return null;
    const metric = (await this.findBestFieldInText(q, 'measure')) || this.getDefaultMetric();
    return { field, metric, direction };
  }

  detectUnsupportedMetric(q) {
    const knownMetricTerms = new Set(
      this.catalog()
        .filter((f) => f.role === 'measure')
        .flatMap((f) =>
          [f.label, f.column, ...(f.synonyms || []), ...this.localizedTerms(f)].map(norm),
        ),
    );
    const term = this.termMatcher.first(q, 'unsupportedMetric');
    return term && !knownMetricTerms.has(term) ? term : null;
  }

  extractTopDimensionPhrase(q) {
    const topOrBottom = [this.termAlternation('top'), this.termAlternation('bottom')]
      .filter(Boolean)
      .join('|');
    const by = this.termAlternation('by');
    if (!topOrBottom || !by) return null;
    const m = q.match(new RegExp(`\\b(?:${topOrBottom})\\s+\\d+\\s+(.+?)\\s+(?:${by})\\s+`));
    return m
      ? singularize(
          m[1]
            .replace(new RegExp(`\\b(?:${by}|${this.termAlternation('filters')})\\b.*$`), '')
            .trim(),
        )
      : null;
  }

  extractByPhrases(q) {
    const by = this.termAlternation('by');
    if (!by) return [];
    const byRe = new RegExp(`\\b(?:${by})\\b\\s*`, 'i');
    const firstBy = q.search(byRe);
    if (firstBy < 0) return [];
    const filters = this.termAlternation('filters');
    const rest = q
      .slice(firstBy)
      .replace(byRe, '')
      .replace(filters ? new RegExp(`\\b(?:${filters})\\b.*$`, 'i') : /$a/, '')
      .replace(/\bsorted.*$/i, '')
      .trim();
    if (!rest) return [];
    const and = this.termAlternation('and');
    const separators = [`\\s+(?:${by})\\s+`, '\\s*,\\s*'];
    if (and) separators.push(`\\s+(?:${and})\\s+`);
    const splitRe = new RegExp(separators.join('|'), 'i');
    return rest
      .split(splitRe)
      .map((p) => singularize(p.trim()))
      .filter(Boolean);
  }

  terms(group) {
    return this.termMatcher.terms(group);
  }
  termAlternation(group) {
    return this.termMatcher.alternation(group);
  }
  hasTerm(q, group) {
    return this.termMatcher.has(q, group);
  }
}

export class CatalogBuilder {
  config: { dataSources?: Array<{ name: string }>; relationships?: Relationship[] };
  askConfig: { fields?: import('./types').FieldConfig[]; entities?: import('./types').EntityConfig[]; relationships?: Relationship[]; inferRelationships?: boolean; profiling?: { maxDistinctValuesPerField?: number; maxSampleRows?: number }; relationshipInference?: { autoAcceptThreshold?: number; ambiguousThreshold?: number } };
  duckDBManager: { query: (sql: string) => Promise<unknown> };
  fieldByKey: Map<string, CatalogField>;
  displayLabel: (item: CatalogField | import('./types').EntityConfig) => string;
  localizedTerms: (item: CatalogField | import('./types').EntityConfig) => string[];
  timeSqlExpression: (field: CatalogField, alias: string) => string;

  constructor({
    config,
    askConfig,
    duckDBManager,
    fieldByKey,
    displayLabel,
    localizedTerms,
    timeSqlExpression,
  }: {
    config: CatalogBuilder['config'];
    askConfig?: CatalogBuilder['askConfig'];
    duckDBManager: CatalogBuilder['duckDBManager'];
    fieldByKey: Map<string, CatalogField>;
    displayLabel: CatalogBuilder['displayLabel'];
    localizedTerms: CatalogBuilder['localizedTerms'];
    timeSqlExpression: CatalogBuilder['timeSqlExpression'];
  }) {
    this.config = config;
    this.askConfig = askConfig || {};
    this.duckDBManager = duckDBManager;
    this.fieldByKey = fieldByKey;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.timeSqlExpression = timeSqlExpression;
  }

  async build() {
    this.fieldByKey.clear();
    const overrides = new Map(
      (this.askConfig.fields || []).map((f) => [fieldKey(f.table, f.column), f]),
    );
    const tableProfiles = new Map<string, { rowCount: number }>();
    const fields: CatalogField[] = [];

    for (const source of this.config.dataSources || []) {
      const table = source.name;
      const countRows = toRows(
        await this.duckDBManager.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdent(table)}`),
      );
      const rowCount = numberValue(
        countRows[0]?.row_count ?? countRows[0]?.rowCount ?? countRows[0]?.count_star ?? 0,
      );
      tableProfiles.set(table, { rowCount });

      const schemaRows = toRows(
        await this.duckDBManager.query(`DESCRIBE SELECT * FROM ${quoteIdent(table)}`),
      );
      for (const col of schemaRows) {
        const field = await this.buildField({ table, rowCount, col, overrides });
        if (!field) continue;
        fields.push(field);
        this.fieldByKey.set(field.id, field);
      }
    }

    const { relationships, ambiguousRelationships } = this.inferRelationships(
      fields,
      tableProfiles,
    );
    const entities = this.buildEntities(fields);
    return { catalog: fields, relationships, ambiguousRelationships, entities };
  }

  async buildField({ table, rowCount, col, overrides }) {
    const column = col.column_name || col.columnName || col.name;
    const type = col.column_type || col.columnType || col.type || '';
    if (!column) return null;
    const override = overrides.get(fieldKey(table, column)) || {};
    const sampleRows = toRows(
      await this.duckDBManager.query(
        `SELECT ${quoteIdent(column)} AS v FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} IS NOT NULL LIMIT ${this.askConfig.profiling?.maxSampleRows || 1000}`,
      ),
    );
    const samples = sampleRows.map((r) => r.v).filter((v) => v !== null && v !== undefined);
    const distinctRows = toRows(
      await this.duckDBManager.query(
        `SELECT COUNT(DISTINCT ${quoteIdent(column)}) AS distinct_count FROM ${quoteIdent(table)}`,
      ),
    );
    const cardinality = numberValue(distinctRows[0]?.distinct_count ?? 0);
    const nameLooksDate = isDateName(column);
    const parseFormat = override.parseFormat || (nameLooksDate ? detectDateFormat(samples) : null);
    const role = this.inferRole({ override, parseFormat, nameLooksDate, column, type });
    const lowEnoughCardinality =
      cardinality <= (this.askConfig.profiling?.maxDistinctValuesPerField || 100);
    const sampleValues =
      role === 'dimension' && lowEnoughCardinality
        ? [...new Set(samples.map(String))]
            .sort()
            .slice(0, this.askConfig.profiling?.maxDistinctValuesPerField || 100)
        : [];
    const field: CatalogField = {
      id: fieldKey(table, column),
      table,
      column,
      type,
      role,
      label: override.label || column,
      labels: override.labels || {},
      aggregation: override.aggregation || (role === 'measure' ? 'SUM' : undefined),
      synonyms: override.synonyms || [],
      localizedSynonyms: override.localizedSynonyms || {},
      description: override.description || '',
      format: override.format,
      default: !!override.default,
      priority: override.priority || 0,
      parseFormat,
      sampleValues,
      samples: samples.slice(0, 100),
      dateProfile: null,
      cardinality,
      rowCount,
    };
    if (field.role === 'time') field.dateProfile = await this.profileTimeField(field);
    return field;
  }

  inferRole({ override, parseFormat, nameLooksDate, column, type }) {
    if (override.role) return override.role;
    if (parseFormat || nameLooksDate) return 'time';
    if (isIdLike(column)) return 'key';
    if (isNumericType(type)) return 'measure';
    return 'dimension';
  }

  async profileTimeField(field) {
    try {
      const expr = this.timeSqlExpression(field, quoteIdent(field.table));
      const sql = `SELECT MIN(CAST(${expr} AS DATE)) AS min_date, MAX(CAST(${expr} AS DATE)) AS max_date FROM ${quoteIdent(field.table)} WHERE ${expr} IS NOT NULL`;
      const row = toRows(await this.duckDBManager.query(sql))[0] || {};
      const minDate = asIsoDate(row.min_date);
      const maxDate = asIsoDate(row.max_date);
      if (!minDate || !maxDate) return null;
      const max = new Date(`${maxDate}T00:00:00Z`);
      const latestMonthStart = startOfMonth(max);
      const latestYearStart = startOfYear(max);
      return {
        minDate,
        maxDate,
        latestMonthStart: isoDate(latestMonthStart),
        latestMonthEnd: isoDate(addMonths(latestMonthStart, 1)),
        latestYearStart: isoDate(latestYearStart),
        latestYearEnd: isoDate(new Date(Date.UTC(latestYearStart.getUTCFullYear() + 1, 0, 1))),
      };
    } catch (err) {
      console.warn('[AskData] Failed to profile time field', field.id, err);
      return null;
    }
  }

  scoreAndClassifyRelationships(byColumn) {
    const accepted: Relationship[] = [];
    const ambiguous: Relationship[] = [];
    for (const matches of byColumn.values()) {
      for (let i = 0; i < matches.length; i++) {
        for (let j = i + 1; j < matches.length; j++) {
          const rel = this.scoreRelationship(matches[i], matches[j]);
          if (!rel) continue;
          if (rel.confidence >= (this.askConfig.relationshipInference?.autoAcceptThreshold || 0.85))
            accepted.push(rel);
          else if (rel.confidence >= (this.askConfig.relationshipInference?.ambiguousThreshold || 0.6))
            ambiguous.push(rel);
        }
      }
    }
    return { accepted, ambiguous };
  }

  inferRelationships(fields, _tableProfiles) {
    const explicit = this.config.relationships || this.askConfig.relationships || [];
    if (explicit.length)
      return {
        relationships: explicit.map((r) => ({ ...r, confidence: 1, inferred: false })),
        ambiguousRelationships: [],
      };
    if (this.askConfig.inferRelationships === false)
      return { relationships: [], ambiguousRelationships: [] };

    const byColumn = new Map<string, CatalogField[]>();
    for (const f of fields.filter((f) => f.role === 'key' || isIdLike(f.column))) {
      const key = compact(f.column);
      if (!byColumn.has(key)) byColumn.set(key, []);
      byColumn.get(key)!.push(f);
    }

    const { accepted, ambiguous } = this.scoreAndClassifyRelationships(byColumn);
    return { relationships: accepted, ambiguousRelationships: ambiguous };
  }

  scoreRelationship(a, b) {
    if (a.table === b.table) return null;
    const overlap = this.sampleOverlap(a.samples, b.samples);
    const aUnique = a.cardinality / Math.max(1, a.rowCount);
    const bUnique = b.cardinality / Math.max(1, b.rowCount);
    const oneSideLookup = (aUnique > 0.75 && bUnique < 0.95) || (bUnique > 0.75 && aUnique < 0.95);
    let score = 0.45;
    if (/id$/i.test(norm(a.column).replaceAll(' ', ''))) score += 0.25;
    if (overlap > 0.2) score += 0.2;
    if (oneSideLookup) score += 0.1;
    return {
      left: { table: a.table, column: a.column },
      right: { table: b.table, column: b.column },
      confidence: Number(score.toFixed(2)),
      inferred: true,
      overlap: Number(overlap.toFixed(2)),
    };
  }

  sampleOverlap(aValues, bValues) {
    const a = new Set(aValues.map(String));
    const b = new Set(bValues.map(String));
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    for (const v of a) if (b.has(v)) overlap++;
    return overlap / Math.min(a.size, b.size);
  }

  buildEntities(fields: CatalogField[]): Entity[] {
    const configured = this.askConfig.entities || [];
    const entities: Entity[] = configured
      .map((e) => ({
        ...e,
        field: this.fieldByKey.get(fieldKey(e.table, e.key)),
        terms: [
          e.label,
          this.displayLabel(e),
          e.singular,
          ...(e.synonyms || []),
          ...this.localizedTerms(e),
        ]
          .filter(Boolean)
          .map(norm),
      }))
      .filter((e): e is Entity => !!e.field);

    for (const field of fields.filter((f) => f.role === 'key' && / id$/i.test(f.column))) {
      const base = field.column.replace(/ ID$/i, '').replace(/ID$/i, '');
      if (!entities.some((e) => e.table === field.table && e.key === field.column)) {
        entities.push({
          label: `${base}s`,
          singular: base,
          table: field.table,
          key: field.column,
          field,
          terms: [norm(base), norm(`${base}s`)],
        });
      }
    }
    for (const entity of entities) {
      const configuredDims = (entity.preferredDimensions || [])
        .map((column) => this.fieldByKey.get(fieldKey(entity.table, column)))
        .filter((f): f is CatalogField => !!f);
      const inferred = fields
        .filter((f) => f.table === entity.table && f.role === 'dimension')
        .sort((a, b) => a.cardinality - b.cardinality || (b.priority || 0) - (a.priority || 0));
      entity.preferredDimensionFields = configuredDims.length ? configuredDims : inferred;
    }
    return entities;
  }
}

export class AskDataEngine {
  config: { dataSources?: Array<{ name: string }>; relationships?: Relationship[]; askData?: Partial<import('./types').AskDataConfig> };
  askConfig: Partial<import('./types').AskDataConfig>;
  duckDBManager: { query: (sql: string) => Promise<unknown> };
  catalog: CatalogField[];
  fieldByKey: Map<string, CatalogField>;
  relationships: Relationship[];
  ambiguousRelationships: Relationship[];
  entities: Entity[];
  fieldFuse: FieldFuse | null;
  fieldSearchIndex: FieldSearchIndex | null;
  valueFuse: ValueFuse | null;
  valueItems: ValueItem[];
  valuePhraseMaxWords: number;
  locale: string;
  localeFamily: string;
  vocabulary: Vocabulary;
  termMatcher: TermMatcher;
  chronoParser: typeof chronoEn | typeof chronoPt;
  dateRangeParser: DateRangeParser;
  intentCues: IntentCueDetector;
  shapeAnalyzer: import('./result-analysis').ResultShapeAnalyzer;
  chartDecisionTree: import('./result-analysis').ChartDecisionTree;
  resultValidator: import('./result-analysis').ResultValidator;
  sqlPlanner: SqlPlanner;
  catalogBuilder: CatalogBuilder;
  confidenceScorer: import('./result-analysis').ConfidenceScorer;
  insightGenerator: import('./result-analysis').InsightGenerator;
  semanticMatcher: SemanticFieldMatcher;
  fieldResolver: FieldResolver;
  filterResolver: ValueFilterResolver;
  metrics: { catalogBuildMs: number | null };
  questionParser: QuestionParser;
  initialized: boolean;
  semanticModelingEngine: SemanticModelingEngine;
  narrativeGenerator: NarrativeGenerator;
  autoSemanticEnabled: boolean;
  autoNarrativesEnabled: boolean;

  constructor(config: AskDataEngine['config'], duckDBManager: AskDataEngine['duckDBManager']) {
    this.config = config;
    this.askConfig = config.askData || {};
    this.duckDBManager = duckDBManager;
    this.catalog = [];
    this.fieldByKey = new Map();
    this.relationships = [];
    this.ambiguousRelationships = [];
    this.entities = [];
    this.fieldFuse = null;
    this.fieldSearchIndex = null;
    this.valueFuse = null;
    this.valueItems = [];
    this.valuePhraseMaxWords = 1;
    this.locale = this.resolveLocale();
    this.localeFamily = this.locale.toLowerCase().startsWith('pt') ? 'pt' : 'en';
    this.vocabulary = this.buildVocabulary();
    this.termMatcher = new TermMatcher(this.vocabulary, this.localeFamily);
    this.chronoParser = this.localeFamily === 'pt' ? chronoPt : chronoEn;
    this.dateRangeParser = new DateRangeParser({
      primaryParser: this.chronoParser,
      fallbackParser: this.localeFamily === 'pt' ? chronoEn : chronoPt,
      termMatcher: this.termMatcher,
      locale: this.locale,
    });
    this.intentCues = new IntentCueDetector(this.termMatcher);
    this.shapeAnalyzer = new ResultShapeAnalyzer();
    this.chartDecisionTree = new ChartDecisionTree(this.askConfig.chartCapabilities || {});
    this.resultValidator = new ResultValidator();
    this.sqlPlanner = new SqlPlanner({
      config: this.config,
      askConfig: this.askConfig,
      relationships: () => this.relationships,
      getDefaultTimeField: () => this.getDefaultTimeField(),
    });
    this.catalogBuilder = new CatalogBuilder({
      config: this.config,
      askConfig: this.askConfig,
      duckDBManager: this.duckDBManager,
      fieldByKey: this.fieldByKey,
      displayLabel: (item) => this.displayLabel(item),
      localizedTerms: (item) => this.localizedTerms(item),
      timeSqlExpression: (field, alias) => this.sqlPlanner.timeSqlExpression(field, alias),
    });
    this.confidenceScorer = new ConfidenceScorer({
      config: this.config,
      termMatcher: this.termMatcher,
      displayLabel: (field) => this.displayLabel(field),
      localizedTerms: (field) => this.localizedTerms(field),
      buildJoinPlan: (baseTable, neededTables) =>
        this.sqlPlanner.buildJoinPlan(baseTable, neededTables),
    });
    this.insightGenerator = new InsightGenerator();
    this.semanticMatcher = new SemanticFieldMatcher(this.askConfig.semanticMatching || {}, {
      displayLabel: (item) => this.displayLabel(item),
      localizedTerms: (item) => this.localizedTerms(item),
    });
    this.semanticModelingEngine = new SemanticModelingEngine();
    this.autoSemanticEnabled = this.askConfig.autoSemanticModeling !== false;
    this.narrativeGenerator = new NarrativeGenerator();
    this.autoNarrativesEnabled = this.askConfig.autoNarratives !== false;
    this.fieldResolver = new FieldResolver(
      [
        new ExactFieldMatchStrategy({
          catalog: () => this.catalog,
          displayLabel: (field) => this.displayLabel(field),
          localizedTerms: (field) => this.localizedTerms(field),
          termMatcher: this.termMatcher,
        }),
        new TextSearchFieldMatchStrategy({ fieldSearchIndex: () => this.fieldSearchIndex }),
        new FuseFieldMatchStrategy({ fieldFuse: () => this.fieldFuse }),
        new SemanticFieldMatchStrategy({
          semanticMatcher: this.semanticMatcher,
          catalog: () => this.catalog,
        }),
      ],
      (pending, message, fields) => this.fieldClarification(pending, message, fields),
    );
    this.filterResolver = new ValueFilterResolver({
      valueItems: () => this.valueItems,
      valueFuse: () => this.valueFuse,
      valuePhraseMaxWords: () => this.valuePhraseMaxWords,
      displayLabel: (field) => this.displayLabel(field),
      localizedTerms: (field) => this.localizedTerms(field),
    });
    this.metrics = { catalogBuildMs: null };
    this.questionParser = new QuestionParser({
      askConfig: this.askConfig,
      catalog: () => this.catalog,
      entities: () => this.entities,
      termMatcher: this.termMatcher,
      intentCues: this.intentCues,
      filterResolver: this.filterResolver,
      dateRangeParser: this.dateRangeParser,
      localizedTerms: (field) => this.localizedTerms(field),
      resolveFieldPhrase: (phrase, roles, clarification) =>
        this.fieldResolver.resolvePhrase(phrase, roles, clarification as Record<string, unknown> | null),
      findBestFieldInText: (q, role) => this.fieldResolver.findInText(q, role),
      getDefaultMetric: () => this.getDefaultMetric(),
      getDefaultTimeField: () => this.getDefaultTimeField(),
    });
    this.initialized = false;
  }

  resolveLocale() {
    const configured = this.askConfig.locale;
    const browserLocale = typeof navigator !== 'undefined' ? navigator.language : '';
    const locale = configured && configured !== 'auto' ? configured : browserLocale;
    return locale || this.askConfig.locales?.fallback || 'en-US';
  }

  buildVocabulary() {
    const defaults = {
      en: {
        by: ['by'],
        top: ['top', 'best', 'highest'],
        bottom: ['bottom', 'worst', 'lowest'],
        most: ['most', 'highest', 'largest', 'biggest', 'best'],
        least: ['least', 'lowest', 'smallest', 'worst'],
        count: ['count', 'number of', 'how many'],
        overTime: ['over time', 'trend'],
        filters: ['in', 'for', 'where', 'with'],
        and: ['and'],
        prepositions: ['of', 'for', 'in'],
        listAction: ['which', 'what', 'list', 'show'],
        subjectQuestion: ['which', 'what'],
        ownershipVerb: ['has'],
        article: ['the'],
        listAvailability: ['do i have', 'are there', 'exist', 'available'],
        listKind: ['kind', 'kinds', 'type', 'types'],
        listCategory: ['category', 'categories'],
        listSubcategory: ['subcategory', 'sub category', 'sub categories'],
        latestYear: ['latest year', 'last year'],
        latestMonth: ['latest month', 'last month'],
        thisYear: ['this year'],
        thisMonth: ['this month'],
        dateCue: [
          'today',
          'yesterday',
          'tomorrow',
          'last',
          'this',
          'next',
          'year',
          'month',
          'week',
          'quarter',
          'day',
        ],
        yearCue: ['year'],
        monthCue: ['month'],
        dayCue: ['day', 'today', 'yesterday', 'tomorrow'],
        dayGrain: ['day', 'daily'],
        monthGrain: ['month', 'monthly'],
        yearGrain: ['year', 'yearly', 'annual'],
        yearOverYear: ['year over year', 'yoy', 'year on year'],
        comparison: ['compare', 'versus', 'vs'],
        change: ['change', 'changed', 'delta', 'growth'],
        share: ['share', 'percent', 'percentage', 'proportion'],
        unsupportedMetric: ['profit', 'margin', 'earnings', 'cost'],
      },
      pt: {
        by: ['por'],
        top: ['top', 'maiores', 'melhores'],
        bottom: ['menores', 'piores'],
        most: ['maior', 'maiores', 'melhor', 'melhores', 'mais'],
        least: ['menor', 'menores', 'pior', 'piores', 'menos'],
        count: ['contar', 'conte', 'quantos', 'numero de', 'número de'],
        overTime: ['ao longo do tempo', 'tendencia', 'tendência', 'evolucao', 'evolução'],
        filters: ['em', 'para', 'onde', 'com'],
        and: ['e'],
        prepositions: ['de', 'do', 'da', 'para', 'em'],
        listAction: ['quais', 'qual', 'liste', 'mostrar'],
        subjectQuestion: ['quais', 'qual'],
        ownershipVerb: ['tem', 'possui'],
        article: ['o', 'a'],
        listAvailability: ['tenho', 'existem', 'disponiveis', 'disponíveis'],
        listKind: ['tipo', 'tipos'],
        listCategory: ['categoria', 'categorias'],
        listSubcategory: ['subcategoria', 'subcategorias', 'sub categoria'],
        latestYear: ['ano mais recente', 'ultimo ano', 'último ano', 'ano passado', 'ano anterior'],
        latestMonth: [
          'mes mais recente',
          'mês mais recente',
          'ultimo mes',
          'último mês',
          'mes passado',
          'mês passado',
          'mes anterior',
          'mês anterior',
        ],
        thisYear: ['este ano', 'esse ano'],
        thisMonth: ['este mes', 'este mês', 'esse mes', 'esse mês'],
        dateCue: [
          'hoje',
          'ontem',
          'amanha',
          'amanhã',
          'passado',
          'passada',
          'este',
          'esta',
          'proximo',
          'próximo',
          'ano',
          'mes',
          'mês',
          'semana',
          'trimestre',
          'dia',
        ],
        yearCue: ['ano'],
        monthCue: ['mes', 'mês'],
        dayCue: ['dia', 'hoje', 'ontem', 'amanha', 'amanhã'],
        dayGrain: ['dia', 'diario', 'diária', 'diario', 'diaria'],
        monthGrain: ['mes', 'mês', 'mensal'],
        yearGrain: ['ano', 'anual'],
        yearOverYear: ['ano a ano', 'ano contra ano'],
        comparison: ['comparar', 'compare', 'versus', 'vs', 'contra'],
        change: ['mudanca', 'mudança', 'variacao', 'variação', 'crescimento'],
        share: ['participacao', 'participação', 'percentual', 'porcentagem'],
        unsupportedMetric: ['lucro', 'margem', 'custo'],
      },
    };
    const configured: Vocabulary = this.askConfig.vocabulary || {};
    const merged: Vocabulary = structuredClone(defaults);
    for (const [lang, groups] of Object.entries(
      configured as Record<string, Record<string, string[]>>,
    )) {
      merged[lang] ||= {};
      for (const [group, terms] of Object.entries(groups))
        merged[lang][group] = [...new Set([...(merged[lang][group] || []), ...terms])];
    }
    return merged;
  }

  terms(group) {
    return this.termMatcher.terms(group);
  }

  termAlternation(group) {
    return this.termMatcher.alternation(group);
  }

  hasTerm(q, group) {
    return this.termMatcher.has(q, group);
  }

  localizedMapValue(map, fallback) {
    if (!map) return fallback;
    return (
      map[this.locale] ||
      map[this.localeFamily] ||
      Object.entries(map).find(([key]) => key.toLowerCase().startsWith(this.localeFamily))?.[1] ||
      fallback
    );
  }

  localizedTerms(item) {
    const map = item.localizedSynonyms || item.localizedTerms;
    if (!map) return [];
    const active = this.localizedMapValue(map, []);
    const all = Object.values(map).flat().filter(Boolean);
    return [...new Set([...(Array.isArray(active) ? active : []), ...all])];
  }

  displayLabel(item) {
    return this.localizedMapValue(item.labels, item.label || item.column || '');
  }

  async initialize() {
    if (this.initialized) return;
    console.info('[AskData] Building data catalog');
    const catalogStarted = performance.now();
    await this.buildCatalog();
    this.buildFuseIndexes();
    this.metrics.catalogBuildMs = Math.round(performance.now() - catalogStarted);
    this.initialized = true;
    console.info('[AskData] Ready', {
      fields: this.catalog.length,
      relationships: this.relationships,
      ambiguousRelationships: this.ambiguousRelationships,
    });
  }

  async buildCatalog() {
    const built = await this.catalogBuilder.build();
    this.catalog = built.catalog;
    this.relationships = built.relationships;
    this.ambiguousRelationships = built.ambiguousRelationships;
    this.entities = built.entities;
  }

  buildFuseIndexes() {
    const fieldItems = this.catalog.map((field) => {
      const activeLabel = this.displayLabel(field);
      const activeSynonyms = this.localizedTerms(field);
      const allSynonyms = [
        ...new Set([
          ...(field.synonyms || []),
          ...Object.values(field.localizedSynonyms || {}).flat(),
        ]),
      ];
      return {
        field,
        text: [activeLabel, field.label, field.column, ...allSynonyms].join(' '),
        activeLabel,
        activeSynonyms,
        label: field.label,
        column: field.column,
        synonyms: field.synonyms || [],
        allSynonyms,
        role: field.role,
      };
    });
    this.fieldFuse = new Fuse(fieldItems, {
      includeScore: true,
      threshold: 0.35,
      keys: [
        { name: 'activeLabel', weight: 0.45 },
        { name: 'activeSynonyms', weight: 0.45 },
        { name: 'label', weight: 0.3 },
        { name: 'column', weight: 0.3 },
        { name: 'synonyms', weight: 0.25 },
        { name: 'allSynonyms', weight: 0.2 },
        { name: 'text', weight: 0.1 },
      ],
    });
    this.fieldSearchIndex = new FieldSearchIndex({
      catalog: () => this.catalog,
      displayLabel: (field) => this.displayLabel(field),
      localizedTerms: (field) => this.localizedTerms(field),
    });
    this.fieldSearchIndex.rebuild();

    this.valueItems = [];
    for (const field of this.catalog.filter((f) => f.role === 'dimension')) {
      for (const value of field.sampleValues || []) {
        const normalizedValue = norm(value);
        if (normalizedValue) this.valueItems.push({ value, normalizedValue, field });
      }
    }
    this.valuePhraseMaxWords = Math.max(
      1,
      ...this.valueItems.map((item) => item.normalizedValue.split(/\s+/).length),
    );
    this.valueFuse = new Fuse(this.valueItems, {
      includeScore: true,
      threshold: 0.2,
      ignoreLocation: true,
      keys: ['normalizedValue', 'value'],
    });
  }

  async ask(question, options: Record<string, unknown> = {}) {
    const totalStarted = performance.now();
    await this.initialize();
    const parseStarted = performance.now();
    const parsed = await this.parseQuestion(question, options);
    const parseMs = Math.round(performance.now() - parseStarted);
    if (parsed.error)
      return {
        ...parsed,
        metrics: {
          catalogBuildMs: this.metrics.catalogBuildMs,
          parseMs,
          totalAskMs: Math.round(performance.now() - totalStarted),
        },
      };
    if (parsed.clarification)
      return {
        ...parsed,
        metrics: {
          catalogBuildMs: this.metrics.catalogBuildMs,
          parseMs,
          totalAskMs: Math.round(performance.now() - totalStarted),
        },
      };
    const planned = this.planSql(parsed.intent);
    if (planned.error)
      return {
        ...planned,
        metrics: {
          catalogBuildMs: this.metrics.catalogBuildMs,
          parseMs,
          totalAskMs: Math.round(performance.now() - totalStarted),
        },
      };
    console.info('[AskData] SQL', planned.sql);
    const sqlStarted = performance.now();
    if (!planned.sql) {
      return {
        error: planned.error || 'Failed to generate SQL query',
        metrics: {
          catalogBuildMs: this.metrics.catalogBuildMs,
          parseMs,
          totalAskMs: Math.round(performance.now() - totalStarted),
        },
      };
    }
    const result = await this.duckDBManager.query(planned.sql);
    const sqlExecutionMs = Math.round(performance.now() - sqlStarted);
    const rows = toRows(result).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]),
      ),
    );
    const columns = rows.length ? Object.keys(rows[0]) : planned.columns;
    const diagnostics = await this.evaluateDiagnostics(planned);
    const shape = this.shapeAnalyzer.analyze(rows, columns, parsed.intent);
    const chartDecision = this.chartDecisionTree.decide(shape, parsed.intent);
    const insights = this.insightGenerator.generate(rows, parsed.intent, shape);
    let narratives: NarrativeResult | null = null;
    if (this.autoNarrativesEnabled && rows.length > 0) {
      try {
        const metricField = parsed.intent.metric && 'table' in parsed.intent.metric ? parsed.intent.metric : null;
        narratives = this.narrativeGenerator.generateNarratives(rows, parsed.intent, shape, metricField);
      } catch (err) {
        console.warn('[AskData] Narrative generation failed', err);
      }
    }
    const confidence = this.confidenceScorer.estimate(parsed.intent);
    const validationWarnings = this.resultValidator.validate({
      rows,
      intent: parsed.intent,
      confidence,
      diagnostics,
    });
    const evidence = this.describeEvidence(parsed.intent);
    return {
      question,
      interpretation: this.describeIntent(parsed.intent),
      intent: parsed.intent,
      sql: planned.sql,
      rows,
      columns,
      shape,
      diagnostics,
      chartDecision,
      insights,
      narratives,
      evidence,
      chartType: chartDecision.rendered,
      warnings: [...(parsed.warnings || []), ...validationWarnings],
      confidence,
      metrics: {
        catalogBuildMs: this.metrics.catalogBuildMs,
        parseMs,
        sqlExecutionMs,
        totalAskMs: Math.round(performance.now() - totalStarted),
      },
    };
  }

  parseQuestion(question, options: Record<string, unknown> = {}) {
    return this.questionParser.parse(question, options);
  }

  async evaluateJoinFanout(fanout) {
    if (!fanout?.baseCountSql || !fanout?.joinedCountSql) return;
    try {
      const baseRow = toRows(await this.duckDBManager.query(fanout.baseCountSql))[0] || {};
      const joinedRow = toRows(await this.duckDBManager.query(fanout.joinedCountSql))[0] || {};
      const baseCount = numberValue(baseRow.row_count ?? baseRow.rowCount ?? 0);
      const joinedCount = numberValue(joinedRow.row_count ?? joinedRow.rowCount ?? 0);
      let ratio: number;
      if (baseCount > 0) ratio = joinedCount / baseCount;
      else if (joinedCount > 0) ratio = Infinity;
      else ratio = 1;
      Object.assign(fanout, {
        baseCount,
        joinedCount,
        ratio: Number.isFinite(ratio) ? Number(ratio.toFixed(3)) : ratio,
      });
      if (joinedCount - baseCount >= fanout.minExtraRows && ratio >= fanout.threshold) {
        fanout.warning = `Joined row count is ${ratio.toFixed(1)}x the base ${fanout.baseTable} row count (${baseCount.toLocaleString()} → ${joinedCount.toLocaleString()}). This join may duplicate rows and inflate metrics.`;
      }
    } catch (err) {
      fanout.error = String(err);
    }
  }

  async evaluateFilterSelectivity(selectivity) {
    if (!selectivity?.unfilteredCountSql || !selectivity?.filteredCountSql) return;
    try {
      const unfiltered = numberValue(
        (toRows(await this.duckDBManager.query(selectivity.unfilteredCountSql))[0] || {}).row_count,
      );
      const filtered = numberValue(
        (toRows(await this.duckDBManager.query(selectivity.filteredCountSql))[0] || {}).row_count,
      );
      const ratio = unfiltered > 0 ? filtered / unfiltered : 1;
      Object.assign(selectivity, { unfilteredCount: unfiltered, filteredCount: filtered, ratio: Number(ratio.toFixed(3)) });
      if (unfiltered && ratio < selectivity.threshold)
        selectivity.warning = `Filters keep only ${(ratio * 100).toFixed(1)}% of rows (${filtered.toLocaleString()} of ${unfiltered.toLocaleString()}). Results may be sparse.`;
    } catch (err) {
      selectivity.error = String(err);
    }
  }

  async evaluateDateParse(dateParse) {
    if (!dateParse?.sql) return;
    try {
      const row = toRows(await this.duckDBManager.query(dateParse.sql))[0] || {};
      const checkedRows = numberValue(row.checked_rows ?? row.checkedRows ?? 0);
      const droppedRows = numberValue(row.dropped_rows ?? row.droppedRows ?? 0);
      Object.assign(dateParse, { checkedRows, droppedRows });
      if (droppedRows > 0)
        dateParse.warning = `Date parsing dropped ${droppedRows.toLocaleString()} ${dateParse.field} rows.`;
    } catch (err) {
      dateParse.error = String(err);
    }
  }

  async evaluateDiagnostics(planned) {
    const diagnostics = structuredClone(planned.diagnostics || {});
    await this.evaluateJoinFanout(diagnostics.joinFanout);
    await this.evaluateFilterSelectivity(diagnostics.filterSelectivity);
    await this.evaluateDateParse(diagnostics.dateParse);
    return diagnostics;
  }

  fieldClarification(pending, message, fields) {
    const candidates = fields.map((field) => ({
      label: `${this.displayLabel(field)} (${field.table}.${field.column})`,
      fieldId: field.id,
      fieldLabel: this.displayLabel(field),
      table: field.table,
      column: field.column,
    }));
    return {
      clarification: {
        message,
        pending: { ...pending, originalQuestion: null, candidates },
        choices: candidates,
      },
    };
  }

  getDefaultMetric() {
    const explicit = this.askConfig.defaultMetric;
    if (explicit) {
      const field = this.fieldByKey.get(fieldKey(explicit.table, explicit.column));
      if (field) return field;
    }
    const measures = this.catalog.filter((f) => f.role === 'measure');
    return (
      measures.find((f) => f.default) ||
      measures.sort((a, b) => this.measurePriority(b) - this.measurePriority(a))[0] || {
        kind: 'count_star',
        label: 'Records',
      }
    );
  }

  measurePriority(field) {
    const n = norm(field.label + ' ' + field.column);
    const names = [
      'sales',
      'revenue',
      'amount',
      'profit',
      'margin',
      'quantity',
      'count',
      'total',
      'value',
    ];
    const index = names.findIndex((name) => n.includes(name));
    return (field.priority || 0) + (index >= 0 ? 100 - index : 0);
  }

  getDefaultTimeField() {
    const times = this.catalog.filter((f) => f.role === 'time');
    return (
      times.find((f) => f.default) || times.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0]
    );
  }

  timeSqlExpression(field, alias) {
    return this.sqlPlanner.timeSqlExpression(field, alias);
  }

  planSql(intent) {
    return this.sqlPlanner.plan(intent);
  }

  buildJoinPlan(baseTable, neededTables) {
    return this.sqlPlanner.buildJoinPlan(baseTable, neededTables);
  }

  findRelationshipPath(startTables, targetTable) {
    return this.sqlPlanner.findRelationshipPath(startTables, targetTable);
  }

  describeEvidence(intent) {
    const evidence: import('./types').EvidenceItem[] = [];
    if (intent.metric?.kind === 'count_star')
      evidence.push({ kind: 'metric', field: 'Records', source: 'count_star' });
    else if (intent.metric?.kind === 'count_distinct')
      evidence.push({
        kind: 'metric',
        field: this.displayLabel(intent.metric.field),
        table: intent.metric.field.table,
        column: intent.metric.field.column,
        source: 'count_distinct',
      });
    else if (intent.metric?.table)
      evidence.push({
        kind: 'metric',
        field: this.displayLabel(intent.metric),
        table: intent.metric.table,
        column: intent.metric.column,
        source: intent.metric.default ? 'default_metric' : 'resolved_field',
      });
    for (const dimension of intent.dimensions || []) {
      evidence.push({
        kind: 'dimension',
        field: this.displayLabel(dimension),
        table: dimension.table,
        column: dimension.column,
        source: 'resolved_field',
      });
    }
    for (const filter of intent.filters || []) {
      evidence.push({
        kind: 'filter',
        field: this.displayLabel(filter.field),
        table: filter.field.table,
        column: filter.field.column,
        value: filter.operator === 'IN' ? (filter.values || []).join(', ') : filter.value,
        source: filter.source || 'resolved_value',
      });
    }
    if (intent.dateRange?.field) {
      evidence.push({
        kind: 'date',
        field: this.displayLabel(intent.dateRange.field),
        table: intent.dateRange.field.table,
        column: intent.dateRange.field.column,
        source: intent.dateRange.kind || 'date_range',
      });
    }
    return evidence;
  }

  describeMetricPart(intent) {
    if (intent.metric?.kind === 'count_star') return 'Count records';
    if (intent.metric?.kind === 'count_distinct') {
      const entityLabel = this.displayLabel(intent.metric.entity || { label: intent.metric.label });
      return `Count distinct ${entityLabel}`;
    }
    const agg = intent.metric?.aggregation || 'SUM';
    return `${agg}(${this.displayLabel(intent.metric || {})})`;
  }

  describeFilterParts(filters) {
    return filters
      .map((f) => {
        if (f.operator === 'IN') {
          const vals = (f.values || []).join(', ');
          return `${this.displayLabel(f.field)} in ${vals}`;
        }
        return `${this.displayLabel(f.field)} = ${f.value}`;
      })
      .join(' and ');
  }

  describeDatePart(dateRange) {
    if (!dateRange) return '';
    if (dateRange.kind === 'monthOfYear') return ` in month ${dateRange.month}`;
    return ` from ${dateRange.start} to ${dateRange.end}`;
  }

  describeIntent(intent) {
    if (intent.analysisType === 'list_values')
      return `List ${this.displayLabel(intent.dimensions[0])}`;
    if (intent.analysisType === 'yoy')
      return `Year-over-year ${this.displayLabel(intent.metric || {})}`;
    if (intent.analysisType === 'change')
      return `${this.displayLabel(intent.metric || {})} change from ${intent.change?.startYear} to ${intent.change?.endYear}`;
    if (intent.analysisType === 'share')
      return `Share of ${intent.metric?.aggregation || 'SUM'}(${this.displayLabel(intent.metric || {})}) by ${intent.dimensions.map((d) => this.displayLabel(d)).join(' and ')}`;
    if (intent.analysisType === 'comparison') {
      const metric = intent.metric?.kind
        ? this.displayLabel(intent.metric.field || { label: intent.metric.label })
        : this.displayLabel(intent.metric || {});
      const dim = intent.dimensions[0] ? this.displayLabel(intent.dimensions[0]) : 'groups';
      return `Compare ${metric} by ${dim}`;
    }
    const metric = this.describeMetricPart(intent);
    const dims = intent.dimensions.length
      ? ` by ${intent.dimensions.map((d) => this.displayLabel(d)).join(' and ')}`
      : '';
    const filters = intent.filters.length
      ? ` where ${this.describeFilterParts(intent.filters)}`
      : '';
    const dates = this.describeDatePart(intent.dateRange);
    const grain = intent.dimensions.some((d) => d.role === 'time')
      ? ` (${intent.timeGrain || 'month'})`
      : '';
    const sortLabel = intent.sort?.direction === 'ASC' ? 'ascending' : 'descending';
    const limit = intent.dimensions.length
      ? `, sorted ${sortLabel}, limit ${intent.limit}`
      : '';
    return `${metric}${dims}${grain}${filters}${dates}${limit}`;
  }
}
