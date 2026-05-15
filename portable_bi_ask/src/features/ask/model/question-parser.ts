import type {
  AnalysisType,
  CatalogField,
  ClarificationPending,
  Entity,
  FieldRole,
  IntentMetric,
  ParseOptions,
} from '../../../shared/types/index';
import { norm, singularize } from '../../../shared/utils/utils';
import { DateRangeParser } from './date-range-parser';
import { IntentCueDetector } from './intent-cue-detector';
import { TermMatcher } from './term-matcher';
import { ValueFilterResolver } from './value-filter-resolver';

export class QuestionParser {
  askConfig: { maxRows?: number; maxDimensions?: number };
  catalog: () => CatalogField[];
  entities: () => Entity[];
  termMatcher: TermMatcher;
  intentCues: IntentCueDetector;
  filterResolver: ValueFilterResolver;
  dateRangeParser: DateRangeParser;
  localizedTerms: (field: CatalogField) => string[];
  resolveFieldPhrase: (
    phrase: string,
    roles: FieldRole[],
    clarification: ClarificationPending | undefined,
  ) => Promise<{ field?: CatalogField; clarification?: unknown }>;
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

  async parse(question, options: ParseOptions = {}) {
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
      metric,
      limit,
      sortDirection,
      isRanking,
      isYoY,
      timeGrain,
      isCount,
      superlative,
    });
  }

  async buildIntentResult(question, q, fullQ, dateInfo, warnings, options: ParseOptions, resolved) {
    const { metric, limit, sortDirection, isRanking, isYoY, timeGrain, isCount, superlative } =
      resolved;
    const dimensionsResult = await this.resolveDimensions(
      q,
      superlative,
      timeGrain,
      isCount,
      warnings,
      options,
    );
    if (!Array.isArray(dimensionsResult))
      return this.withOriginalQuestion(dimensionsResult, question);
    const dimensions = dimensionsResult as CatalogField[];
    const filters = this.filterResolver.resolve(q, options.clarification);
    if (filters.clarification) return this.withOriginalQuestion(filters, question);
    const share = this.buildShare(fullQ, filters.filters, dimensions);
    const comparison = share ? null : this.buildComparison(q, filters.filters, dimensions);
    const finalDimensions = share?.dimensions || comparison?.dimensions || dimensions;
    const finalFilters = share?.filters || comparison?.filters || filters.filters;

    let analysisType: AnalysisType = 'kpi';
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
        timeGrain:
          timeGrain || (finalDimensions.some((d) => d.role === 'time') ? 'month' : undefined),
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

  listIntent(question, q, dateInfo, listField, warnings, options: ParseOptions = {}) {
    const filters = this.filterResolver.resolve(q, options.clarification);
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

  async resolveByPhrases(
    q: string,
    byPhrases: string[],
    dimensions: CatalogField[],
    options: ParseOptions,
  ): Promise<{ field?: CatalogField; clarification?: unknown } | null> {
    for (const phrase of byPhrases) {
      if (dimensions.length >= (this.askConfig.maxDimensions || 2)) break;
      if (['month', 'year', 'day', 'date', 'time'].includes(phrase) || /over time/.test(q))
        continue;
      const field = await this.resolveFieldPhrase(
        phrase,
        ['dimension', 'time'],
        options.clarification,
      );
      if (field.clarification) return field;
      if (field.field && !dimensions.some((d) => d.id === (field.field as CatalogField).id))
        dimensions.push(field.field as CatalogField);
    }
    return null;
  }

  async resolveDimensions(
    q: string,
    superlative: { field?: CatalogField } | null,
    timeGrain: string | null,
    isCount: boolean,
    warnings: string[],
    options: ParseOptions = {},
  ): Promise<CatalogField[] | { field?: CatalogField; clarification?: unknown }> {
    const dimensions: CatalogField[] = [];
    const topDimensionPhrase = superlative?.field ? null : this.extractTopDimensionPhrase(q);
    if (superlative?.field) dimensions.push(superlative.field);
    const byPhrases = this.extractByPhrases(q);
    if (topDimensionPhrase) {
      const field = await this.resolveFieldPhrase(
        topDimensionPhrase,
        ['dimension', 'time'],
        options.clarification,
      );
      if (field.clarification) return field;
      if (field.field) dimensions.push(field.field);
    }
    const byResult = await this.resolveByPhrases(q, byPhrases, dimensions, options);
    if (byResult?.clarification) return byResult;
    await this.resolveTimeDimension(q, timeGrain, dimensions, warnings);
    if (!dimensions.length && isCount) {
      const byAfterCount = byPhrases[0];
      if (byAfterCount) {
        const field = await this.resolveFieldPhrase(
          byAfterCount,
          ['dimension', 'time'],
          options.clarification,
        );
        if (field.field) dimensions.push(field.field);
      }
    }
    return dimensions;
  }

  async detectListField(q, options: ParseOptions = {}) {
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

  async detectSuperlative(q, options: ParseOptions = {}) {
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
