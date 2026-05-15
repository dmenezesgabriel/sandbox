import type {
  AskChartType,
  AskIntent,
  CatalogField,
  ChartDecision,
  DataRow,
  Diagnostics,
  JoinPlanProvider,
  ResultShape,
} from '../../../shared/types/index';
import { formatValue, norm } from '../../../shared/utils/utils';
import { type AnalysisFacts, ResultAnalyzer } from './result-analyzer';

export class ResultShapeAnalyzer {
  analyze(rows: DataRow[], columns: string[] | undefined, intent: AskIntent): ResultShape {
    const cols = columns || Object.keys(rows[0] || {});
    const numeric: string[] = [];
    const categoric: string[] = [];
    const time: string[] = [];
    for (const col of cols) {
      const values = rows
        .map((row) => row[col])
        .filter((v) => v !== null && v !== undefined && v !== '');
      if (
        intent.dimensions?.some((d) => d.role === 'time') &&
        (col === 'label' || col === 'period')
      )
        time.push(col);
      else if (values.length && values.every((v) => Number.isFinite(Number(v)))) numeric.push(col);
      else categoric.push(col);
    }
    const seriesCount =
      intent.dimensions?.length > 1
        ? new Set(rows.map((r) => String(r.label || '').split(' / ')[0])).size
        : 1;
    const groupCount = new Set(rows.map((r) => String(r.label ?? r.period ?? ''))).size;
    return {
      columns: cols,
      rowCount: rows.length,
      numeric,
      categoric,
      time,
      numericCount: numeric.length,
      categoricCount: categoric.length,
      timeCount: time.length,
      seriesCount,
      groupCount,
      hasMetric: numeric.length > 0,
      oneObservationPerGroup: groupCount === rows.length,
    };
  }
}

export class ChartDecisionTree {
  private readonly capabilities: Partial<Record<AskChartType, boolean>>;

  constructor(capabilities: Partial<Record<AskChartType, boolean>> = {}) {
    this.capabilities = {
      kpi: true,
      table: true,
      bar: true,
      line: true,
      area: true,
      pie: true,
      ...capabilities,
    };
  }

  decide(shape: ResultShape, intent: AskIntent): ChartDecision {
    const fixed = this.decideByAnalysisType(intent);
    if (fixed) return fixed;
    if (!intent.dimensions?.length && shape.numericCount === 1)
      return this.decision(
        ['NUMERIC only', '1 variable', 'single aggregate'],
        'kpi',
        ['bar'],
        'A single aggregate value is best shown as a KPI.',
      );
    if (intent.dimensions?.[0]?.role === 'time') return this.decideTimeSeries(shape);
    if (shape.categoricCount >= 1 && shape.numericCount === 1)
      return this.decideMixed(shape, intent);
    if (shape.numericCount === 2 && shape.categoricCount === 0)
      return this.decideTwoNumerics(shape);
    return this.decision(
      ['Fallback'],
      'table',
      [],
      'The result shape is best preserved as a table with the enabled renderers.',
    );
  }

  private decideByAnalysisType(intent: AskIntent): ChartDecision | null {
    if (intent.analysisType === 'list_values')
      return this.decision(
        ['CATEGORIC only', '1 variable'],
        'table',
        ['bar'],
        'Listing distinct categorical values is clearest as a table.',
      );
    if (intent.analysisType === 'yoy')
      return this.decision(
        ['TIME SERIES', '1 series', 'year-over-year calculation'],
        'table',
        ['line'],
        'YoY includes multiple derived numeric columns, so a table preserves exact values and change percentages.',
      );
    if (intent.analysisType === 'change')
      return this.decision(
        ['TIME SERIES', '2 periods', 'delta calculation'],
        'table',
        ['bar'],
        'Change analysis includes start, end, delta and percent change, so a table preserves exact values.',
      );
    if (intent.analysisType === 'share')
      return this.decision(
        ['PART-TO-WHOLE', 'percent of total'],
        'bar',
        ['pie', 'table'],
        'Percent-of-total results compare contribution by group; bar is reliable and keeps exact share values in the table.',
      );
    return null;
  }

  private decideTimeSeries(shape: ResultShape): ChartDecision {
    const path = ['TIME SERIES', shape.seriesCount > 1 ? 'several series' : '1 series'];
    if (shape.seriesCount > 7)
      return this.decision(
        [...path, 'many series'],
        'table',
        ['heatmap', 'small multiples'],
        'More than 7 line series would be hard to read; table is the enabled fallback.',
      );
    const detail = shape.seriesCount > 1 ? 'few series (<7)' : 'single metric over ordered time';
    return this.decision(
      [...path, detail],
      'line',
      ['area', 'bar'],
      'Time is ordered, so a line chart shows trend direction clearly.',
    );
  }

  private decideMixed(shape: ResultShape, intent: AskIntent): ChartDecision {
    const path = ['NUMERIC + CATEGORIC (mixed)', 'one observation per group', '1 numeric'];
    if (shape.rowCount <= 5 && !intent.sort?.direction && this.capabilities.pie)
      return this.decision(
        path,
        'pie',
        ['bar', 'donut'],
        'Few categories with one numeric can be shown as part-to-whole; anti-pattern guard prevents large pies.',
      );
    return this.decision(
      path,
      'bar',
      ['lollipop', 'treemap'],
      'One numeric metric grouped by categories is most reliably compared with a bar chart.',
    );
  }

  private decideTwoNumerics(shape: ResultShape): ChartDecision {
    const density = shape.rowCount < 2000 ? 'few points (<2000)' : 'many points';
    const chartType = shape.rowCount < 2000 ? 'scatter' : 'table';
    return this.decision(
      ['NUMERIC only', '2 variables', density],
      chartType,
      ['2D density', 'hex bin'],
      'Two numeric variables can be compared as points; dense renderers are not enabled.',
    );
  }

  private decision(
    path: string[],
    recommended: AskChartType,
    alternatives: string[],
    reason: string,
  ): ChartDecision {
    const rendered = this.capabilities[recommended] ? recommended : 'table';
    return {
      path,
      recommended,
      rendered,
      alternatives,
      reason:
        rendered === recommended
          ? reason
          : `${reason} ${recommended} is not enabled, so rendering as table.`,
    };
  }
}

export class ResultValidator {
  validate({
    rows,
    intent,
    confidence,
    diagnostics,
  }: {
    rows: DataRow[];
    intent: AskIntent;
    confidence: number;
    diagnostics: Diagnostics | null;
  }): string[] {
    const warnings: string[] = [];
    if (
      !rows?.length ||
      rows.every((row) =>
        Object.values(row).every((value) => value === null || value === undefined || value === ''),
      )
    )
      warnings.push(
        'No rows matched this question. Try removing filters or broadening the date range.',
      );
    if (confidence < 0.8)
      warnings.push(
        'Some matches were fuzzy or inferred; review SQL/details if the result looks unexpected.',
      );
    if (
      intent.dimensions?.length &&
      rows?.some(
        (row) =>
          String(row.label ?? '').trim() === '' ||
          String(row.label ?? '').includes(' /  / ') ||
          String(row.label ?? '').endsWith(' / '),
      )
    ) {
      warnings.push(
        'Some grouped dimension labels are null or blank. Review source data before drawing conclusions.',
      );
    }
    const fanout = diagnostics?.joinFanout;
    if (fanout?.warning) warnings.push(fanout.warning);
    if (diagnostics?.filterSelectivity?.warning)
      warnings.push(diagnostics.filterSelectivity.warning);
    if (diagnostics?.dateParse?.warning) warnings.push(diagnostics.dateParse.warning);
    if (
      intent.dimensions?.length &&
      intent.analysisType !== 'trend' &&
      rows?.length >= (Number(intent.limit) || Infinity)
    ) {
      warnings.push(`Showing the top ${intent.limit} rows. There may be more matching groups.`);
    }
    return warnings;
  }
}

interface TermMatcherLike {
  patternFromTerm(term: string, flags?: string): RegExp | null;
}

export class ConfidenceScorer {
  private readonly config: { dataSources?: { name: string }[] };
  private readonly termMatcher: TermMatcherLike;
  private readonly displayLabel: (field: Partial<CatalogField> | { label?: string }) => string;
  private readonly localizedTerms: (field: Partial<CatalogField>) => string[];
  private readonly joinPlanProvider: JoinPlanProvider;

  constructor({
    config,
    termMatcher,
    displayLabel,
    localizedTerms,
    joinPlanProvider,
  }: {
    config: { dataSources?: { name: string }[] };
    termMatcher: TermMatcherLike;
    displayLabel: (field: Partial<CatalogField> | { label?: string }) => string;
    localizedTerms: (field: Partial<CatalogField>) => string[];
    joinPlanProvider: JoinPlanProvider;
  }) {
    this.config = config;
    this.termMatcher = termMatcher;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.joinPlanProvider = joinPlanProvider;
  }

  estimate(intent: AskIntent): number {
    const q = norm(intent.question || '');
    const scores: number[] = [];
    const add = (value: number): void => {
      if (Number.isFinite(value)) scores.push(Math.max(0, Math.min(1, value)));
    };
    if (intent.analysisType !== 'list_values') {
      if (intent.metric && 'kind' in intent.metric) add(0.95);
      else add(this.fieldEvidenceScore(q, intent.metric, 0.76));
    }
    for (const dim of intent.dimensions || []) add(this.fieldEvidenceScore(q, dim, 0.82));
    for (const filter of intent.filters || []) add(filter.score || 0.85);
    if (intent.dateRange) add(0.9);
    add(this.joinConfidence(intent));
    const confidence = scores.length ? Math.min(...scores) : 0.7;
    return Number(confidence.toFixed(2));
  }

  fieldEvidenceScore(q: string, field: Partial<CatalogField> | null, fallback = 0.75): number {
    if (!field) return fallback;
    const activeTerms = [
      this.displayLabel(field),
      field.label,
      field.column,
      ...(field.synonyms || []),
      ...this.localizedTerms(field),
    ]
      .map(norm)
      .filter(Boolean);
    const exact = activeTerms.some((term) => this.termMatcher.patternFromTerm(term)?.test(q));
    if (exact) return 0.97;
    const questionTokens = new Set(q.split(/\s+/));
    const evidenceTokens = new Set(activeTerms.flatMap((term) => term.split(/\s+/)));
    const tokenOverlap = [...questionTokens].some((token) => evidenceTokens.has(token));
    if (tokenOverlap) return 0.88;
    return field.default ? Math.max(fallback, 0.78) : fallback;
  }

  joinConfidence(intent: AskIntent): number {
    const filters = intent.filters || [];
    const fields = [
      metricField(intent.metric),
      intent.timeField,
      ...(intent.dimensions || []),
      ...filters.map((f) => f.field),
      intent.dateRange?.field,
    ].filter((f): f is CatalogField => !!f && !!f.table);
    if (!fields.length) return 0.9;
    const metric = metricField(intent.metric);
    const baseTable = metric?.table || fields[0]?.table || this.config.dataSources?.[0]?.name;
    if (!baseTable) return 0.4;
    const neededTables = [...new Set([baseTable, ...fields.map((f) => f.table)])];
    const joinPlan = this.joinPlanProvider.buildJoinPlan(baseTable, neededTables);
    if (joinPlan.error) return 0.4;
    if (!joinPlan.joins?.length) return 0.95;
    return Math.min(...joinPlan.joins.map((rel) => rel.confidence ?? 0.85));
  }
}

export class InsightGenerator {
  private readonly analyzer = new ResultAnalyzer();

  generate(rows: DataRow[], intent: AskIntent, shape: ResultShape): string[] {
    if (!rows?.length) return ['No rows matched this question.'];
    if (intent.analysisType === 'list_values')
      return [
        `Found ${rows.filter((r) => r.label !== null && r.label !== undefined && r.label !== '').length} distinct ${intent.dimensions.map((d) => d.label).join(' / ')} values.`,
      ];
    if (intent.analysisType === 'yoy') return this.yoyInsights(rows);
    if (intent.analysisType === 'change') return this.changeInsights(rows, intent);
    if (!intent.dimensions?.length && rows[0]?.value !== undefined)
      return [
        `Total ${metricLabel(intent)} is ${formatValue(rows[0].value, metricField(intent.metric)?.format)}.`,
      ];
    if (rows[0]?.value !== undefined) return this.groupedMetricInsights(rows, intent, shape);
    return [];
  }

  changeInsights(rows: DataRow[], intent: AskIntent): string[] {
    const row = rows[0];
    if (!row) return [];
    const change = Number(row.change);
    const percent = Number(row.change_percent);
    if (!Number.isFinite(change)) return [];
    const direction = change >= 0 ? 'increased' : 'decreased';
    const percentStr = Number.isFinite(percent)
      ? ` (${formatValue(Math.abs(percent), 'percent')})`
      : '';
    return [
      `${this.labelForMetric(intent)} ${direction} by ${formatValue(Math.abs(change), metricField(intent.metric)?.format)}${percentStr} from ${row.period}.`,
    ];
  }

  labelForMetric(intent: AskIntent): string {
    return metricLabel(intent);
  }

  groupedMetricInsights(
    rows: DataRow[],
    intent: AskIntent,
    shape: ResultShape = {
      columns: [],
      rowCount: 0,
      numeric: [],
      categoric: [],
      time: [],
      numericCount: 0,
      categoricCount: 0,
      timeCount: 0,
      seriesCount: 1,
      groupCount: 0,
      hasMetric: false,
      oneObservationPerGroup: true,
    },
  ): string[] {
    const facts = this.analyzer.analyze(rows, intent, shape);
    if (!facts.valid.length) return [];
    const mf = metricField(intent.metric);
    const fmt = mf?.format;
    const insights: string[] = [];
    this.addExtremeInsights(insights, facts, fmt);
    this.addTopNShareInsight(insights, facts, intent);
    this.addTrendInsight(insights, facts, intent, fmt);
    this.addOutlierInsight(insights, facts, intent);
    return insights;
  }

  private addExtremeInsights(
    insights: string[],
    facts: AnalysisFacts,
    metricFormat: string | undefined,
  ): void {
    const { top, bottom, total } = facts;
    if (!top) return;
    const shareStr = total
      ? ` (${formatValue(Number(top.value) / total, 'percent')} of total)`
      : '';
    insights.push(`${top.label} is highest at ${formatValue(top.value, metricFormat)}${shareStr}.`);
    if (bottom && bottom.label !== top.label)
      insights.push(`${bottom.label} is lowest at ${formatValue(bottom.value, metricFormat)}.`);
  }

  private addTopNShareInsight(insights: string[], facts: AnalysisFacts, intent: AskIntent): void {
    if (facts.topNShare === null) return;
    const topCount = Math.min(3, facts.valid.length);
    const kind = intent.dimensions?.[0]?.role === 'time' ? 'periods' : 'groups';
    insights.push(
      `Top ${topCount} ${kind} account for ${formatValue(facts.topNShare, 'percent')} of total.`,
    );
  }

  private addTrendInsight(
    insights: string[],
    facts: AnalysisFacts,
    intent: AskIntent,
    metricFormat: string | undefined,
  ): void {
    if (intent.dimensions?.[0]?.role !== 'time' || facts.trendChange === null) return;
    const { valid, trendChange, trendPct } = facts;
    const first = valid[0];
    const last = valid[valid.length - 1];
    const direction = trendChange >= 0 ? 'up' : 'down';
    const pctStr = trendPct !== null ? ` (${formatValue(Math.abs(trendPct), 'percent')})` : '';
    insights.push(
      `${last.label} is ${direction} ${formatValue(Math.abs(trendChange), metricFormat)}${pctStr} versus ${first.label}.`,
    );
  }

  private addOutlierInsight(insights: string[], facts: AnalysisFacts, intent: AskIntent): void {
    if (facts.valid.length < 4) return;
    const outliers = facts.valid
      .filter((r) => Number(r.value) > facts.mean * 1.5)
      .map((r) => String(r.label))
      .slice(0, 3);
    if (!outliers.length) return;
    const kind = intent.dimensions?.[0]?.role === 'time' ? 'periods' : 'groups';
    insights.push(`Above-average standout ${kind}: ${outliers.join(', ')}.`);
  }

  yoyInsights(rows: DataRow[]): string[] {
    const last = [...rows]
      .reverse()
      .find(
        (r) =>
          r.change_percent !== null && r.change_percent !== undefined && r.change_percent !== '',
      );
    const insights: string[] = [];
    if (last)
      insights.push(
        `Latest YoY change is ${formatValue(last.change_percent, 'percent')} (${formatValue(last.change, 'currency')}).`,
      );
    const best = rows
      .filter((r) => Number.isFinite(Number(r.change_percent)))
      .sort((a, b) => Number(b.change_percent) - Number(a.change_percent))[0];
    if (best)
      insights.push(
        `Strongest YoY growth was ${String(best.period).slice(0, 4)} at ${formatValue(best.change_percent, 'percent')}.`,
      );
    return insights;
  }
}

function metricField(metric: AskIntent['metric']): CatalogField | null {
  if (!metric) return null;
  if ('kind' in metric) return metric.kind === 'count_distinct' ? metric.field : null;
  return metric;
}

function metricLabel(intent: AskIntent): string {
  const metric = intent.metric;
  if (!metric) return 'value';
  if ('kind' in metric) return metric.label;
  return metric.label || metric.column || 'value';
}
