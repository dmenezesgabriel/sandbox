import type {
  AskIntent,
  CatalogField,
  CountDistinctMetric,
  CountStarMetric,
  DateRange,
  EvidenceItem,
  IntentFilter,
  IntentMetric,
} from '../../../shared/types/index';

export type Labelable = { labels?: Record<string, string>; label?: string; column?: string };

function isCountStar(m: IntentMetric): m is CountStarMetric {
  return m !== null && 'kind' in m && m.kind === 'count_star';
}

function isCountDistinct(m: IntentMetric): m is CountDistinctMetric {
  return m !== null && 'kind' in m && m.kind === 'count_distinct';
}

function isCatalogField(m: IntentMetric): m is CatalogField {
  return m !== null && 'table' in m;
}

export class IntentDescriber {
  private displayLabel: (item: Labelable) => string;

  constructor(displayLabel: (item: Labelable) => string) {
    this.displayLabel = displayLabel;
  }

  private labelOf(
    item:
      | Labelable
      | CatalogField
      | IntentMetric
      | CountStarMetric
      | CountDistinctMetric
      | null
      | undefined,
  ): string {
    if (item === null || item === undefined) return '';
    return this.displayLabel(item as Labelable);
  }

  describeMetricPart(intent: AskIntent): string {
    if (isCountStar(intent.metric)) return 'Count records';
    if (isCountDistinct(intent.metric)) {
      const entityLabel = this.labelOf(intent.metric.entity || { label: intent.metric.label });
      return `Count distinct ${entityLabel}`;
    }
    const agg = isCatalogField(intent.metric) ? intent.metric.aggregation || 'SUM' : 'SUM';
    return `${agg}(${this.labelOf(intent.metric)})`;
  }

  describeFilterParts(filters: IntentFilter[]): string {
    return filters
      .map((f) => {
        if (f.operator === 'IN') {
          const vals = (f.values || []).join(', ');
          return `${this.labelOf(f.field)} in ${vals}`;
        }
        return `${this.labelOf(f.field)} = ${f.value}`;
      })
      .join(' and ');
  }

  describeDatePart(dateRange: DateRange | null | undefined): string {
    if (!dateRange) return '';
    if (dateRange.kind === 'monthOfYear') return ` in month ${dateRange.month}`;
    return ` from ${dateRange.start} to ${dateRange.end}`;
  }

  describeIntent(intent: AskIntent): string {
    if (intent.analysisType === 'list_values') return `List ${this.labelOf(intent.dimensions[0])}`;
    if (intent.analysisType === 'yoy') return `Year-over-year ${this.labelOf(intent.metric)}`;
    if (intent.analysisType === 'change')
      return `${this.labelOf(intent.metric)} change from ${intent.change?.startYear} to ${intent.change?.endYear}`;
    if (intent.analysisType === 'share')
      return `Share of ${isCatalogField(intent.metric) ? intent.metric.aggregation || 'SUM' : 'SUM'}(${this.labelOf(intent.metric)}) by ${intent.dimensions.map((d) => this.labelOf(d)).join(' and ')}`;
    if (intent.analysisType === 'comparison')
      return `Compare ${this.labelOf(intent.metric)} by ${intent.dimensions[0] ? this.labelOf(intent.dimensions[0]) : 'groups'}`;
    const metric = this.describeMetricPart(intent);
    const dims = intent.dimensions.length
      ? ` by ${intent.dimensions.map((d) => this.labelOf(d)).join(' and ')}`
      : '';
    const filters = intent.filters.length
      ? ` where ${this.describeFilterParts(intent.filters)}`
      : '';
    const dates = this.describeDatePart(intent.dateRange ?? null);
    const grain = intent.dimensions.some((d) => d.role === 'time')
      ? ` (${intent.timeGrain || 'month'})`
      : '';
    const sortLabel = intent.sort?.direction === 'ASC' ? 'ascending' : 'descending';
    const limit = intent.dimensions.length ? `, sorted ${sortLabel}, limit ${intent.limit}` : '';
    return `${metric}${dims}${grain}${filters}${dates}${limit}`;
  }

  describeEvidence(intent: AskIntent): EvidenceItem[] {
    const evidence: EvidenceItem[] = [];
    if (isCountStar(intent.metric))
      evidence.push({ kind: 'metric', field: 'Records', source: 'count_star' });
    else if (isCountDistinct(intent.metric))
      evidence.push({
        kind: 'metric',
        field: this.labelOf(intent.metric.field),
        table: intent.metric.field?.table,
        column: intent.metric.field?.column,
        source: 'count_distinct',
      });
    else if (isCatalogField(intent.metric))
      evidence.push({
        kind: 'metric',
        field: this.labelOf(intent.metric),
        table: intent.metric.table,
        column: intent.metric.column,
        source: intent.metric.default ? 'default_metric' : 'resolved_field',
      });
    for (const dimension of intent.dimensions || []) {
      evidence.push({
        kind: 'dimension',
        field: this.labelOf(dimension),
        table: dimension.table,
        column: dimension.column,
        source: 'resolved_field',
      });
    }
    for (const filter of intent.filters || []) {
      evidence.push({
        kind: 'filter',
        field: this.labelOf(filter.field),
        table: filter.field.table,
        column: filter.field.column,
        value: filter.operator === 'IN' ? (filter.values || []).join(', ') : filter.value,
        source: filter.source || 'resolved_value',
      });
    }
    if (intent.dateRange?.field) {
      evidence.push({
        kind: 'date',
        field: this.labelOf(intent.dateRange.field),
        table: intent.dateRange.field.table,
        column: intent.dateRange.field.column,
        source: intent.dateRange.kind || 'date_range',
      });
    }
    return evidence;
  }
}
