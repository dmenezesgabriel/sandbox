import type Fuse from 'fuse.js';
import type MiniSearch from 'minisearch';

// ---------------------------------------------------------------------------
// Primitive cell and row types (used across dashboard, ask, and utils)
// ---------------------------------------------------------------------------
export type PrimitiveCell = string | number | bigint | boolean | Date | null | undefined;
export type CellValue = PrimitiveCell | Record<string, unknown> | unknown[];
export type DataRow = Record<string, CellValue>;
export type Filters = Record<string, string>;
export type ValueFormat = 'currency' | 'percent' | string | undefined;
export type SortDirection = 'ASC' | 'DESC';

// ---------------------------------------------------------------------------
// Ask domain types
// ---------------------------------------------------------------------------
export type FieldRole = 'measure' | 'time' | 'dimension' | 'key';
export type AnalysisType =
  | 'list_values'
  | 'yoy'
  | 'change'
  | 'share'
  | 'comparison'
  | 'trend'
  | 'ranking'
  | 'kpi';
export type AskChartType =
  | 'kpi'
  | 'table'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'histogram';

export interface DateProfile {
  minDate: string;
  maxDate: string;
  latestMonthStart: string;
  latestMonthEnd: string;
  latestYearStart: string;
  latestYearEnd: string;
}

export interface FieldConfig {
  table: string;
  column: string;
  role?: FieldRole;
  aggregation?: string;
  label?: string;
  labels?: Record<string, string>;
  synonyms?: string[];
  localizedSynonyms?: Record<string, string[]>;
  description?: string;
  format?: ValueFormat;
  default?: boolean;
  priority?: number;
  parseFormat?: string | null;
}

export interface CatalogField extends Required<
  Omit<FieldConfig, 'role' | 'aggregation' | 'format' | 'default' | 'parseFormat'>
> {
  id: string;
  type: string;
  role: FieldRole;
  aggregation?: string;
  format?: ValueFormat;
  default: boolean;
  priority: number;
  parseFormat?: string | null;
  sampleValues: string[];
  samples: CellValue[];
  dateProfile: DateProfile | null;
  cardinality: number;
  rowCount: number;
}

export interface EntityConfig {
  label: string;
  labels?: Record<string, string>;
  singular: string;
  table: string;
  key: string;
  synonyms?: string[];
  localizedTerms?: Record<string, string[]>;
  preferredDimensions?: string[];
}

export interface Entity extends EntityConfig {
  field: CatalogField;
  terms: string[];
  preferredDimensionFields?: CatalogField[];
}

export interface RelationshipSide {
  table: string;
  column: string;
}

export interface Relationship {
  left: RelationshipSide;
  right: RelationshipSide;
  confidence?: number;
  inferred?: boolean;
  overlap?: number;
}

export interface SemanticMatchingConfig {
  enabled?: boolean;
  model?: string;
  dtype?: string;
  minScore?: number;
  minMargin?: number;
  batchSize?: number;
}

export type Vocabulary = Record<string, Record<string, string[]>>;

export interface SourceColumnRef {
  table: string;
  column: string;
}

export interface AskDataConfig {
  enabled?: boolean;
  locale?: string;
  locales?: { supported?: string[]; fallback?: string };
  defaultQuestion: string;
  maxRows?: number;
  maxDimensions?: number;
  maxMetrics?: number;
  inferRelationships?: boolean;
  semanticMatching?: SemanticMatchingConfig;
  autoSemanticModeling?: boolean;
  autoNarratives?: boolean;
  profiling?: { maxDistinctValuesPerField?: number; maxSampleRows?: number };
  relationshipInference?: {
    autoAcceptThreshold?: number;
    ambiguousThreshold?: number;
    sampleSize?: number;
  };
  validation?: {
    joinFanoutRatio?: number;
    joinFanoutMinExtraRows?: number;
    filterSelectivityRatio?: number;
  };
  defaultMetric?: SourceColumnRef & { aggregation?: string };
  chartCapabilities?: Partial<Record<AskChartType, boolean>>;
  fields?: FieldConfig[];
  entities?: EntityConfig[];
  examples?: string[];
  vocabulary?: Vocabulary;
  relationships?: Relationship[];
}

export interface CountStarMetric {
  kind: 'count_star';
  label: string;
}

export interface CountDistinctMetric {
  kind: 'count_distinct';
  entity: Entity;
  field: CatalogField;
  label: string;
}

export type IntentMetric = CatalogField | CountStarMetric | CountDistinctMetric | null;

export interface IntentFilter {
  field: CatalogField;
  operator?: '=' | 'IN';
  value?: CellValue;
  values?: CellValue[];
  score?: number;
  source?: string;
}

export type DateRange =
  | { field: CatalogField; start: string; end: string; text: string; kind?: undefined }
  | {
      field: CatalogField;
      kind: 'monthOfYear';
      month: number;
      text: string;
      start?: undefined;
      end?: undefined;
    };

export interface ChangeSpec {
  startYear: number;
  endYear: number;
}

export interface AskIntent {
  question: string;
  analysisType: AnalysisType;
  metric: IntentMetric;
  timeField?: CatalogField | null;
  dimensions: CatalogField[];
  filters: IntentFilter[];
  dateRange?: DateRange | null;
  change?: ChangeSpec | null;
  shareValues?: CellValue[] | null;
  sort?: { by: string; direction: SortDirection };
  limit?: number;
  timeGrain?: 'day' | 'month' | 'year';
}

export interface ResultShape {
  columns: string[];
  rowCount: number;
  numeric: string[];
  categoric: string[];
  time: string[];
  numericCount: number;
  categoricCount: number;
  timeCount: number;
  seriesCount: number;
  groupCount: number;
  hasMetric: boolean;
  oneObservationPerGroup: boolean;
}

export interface ChartDecision {
  path: string[];
  recommended: AskChartType | string;
  rendered: AskChartType;
  alternatives: string[];
  reason: string;
}

export interface DiagnosticJoinFanout {
  baseTable?: string;
  joinedTables?: string[];
  baseCountSql?: string;
  joinedCountSql?: string;
  threshold?: number;
  minExtraRows?: number;
  baseCount?: number;
  joinedCount?: number;
  ratio?: number;
  warning?: string;
  error?: string;
}

export interface DiagnosticFilterSelectivity {
  unfilteredCountSql?: string;
  filteredCountSql?: string;
  threshold?: number;
  unfilteredCount?: number;
  filteredCount?: number;
  ratio?: number;
  warning?: string;
  error?: string;
}

export interface DiagnosticDateParse {
  field?: string;
  sql?: string;
  checkedRows?: number;
  droppedRows?: number;
  warning?: string;
  error?: string;
}

export interface Diagnostics {
  joinFanout?: DiagnosticJoinFanout;
  filterSelectivity?: DiagnosticFilterSelectivity;
  dateParse?: DiagnosticDateParse;
}

export interface EvidenceItem {
  kind: 'metric' | 'dimension' | 'filter' | 'date';
  field: string;
  table?: string;
  column?: string;
  value?: CellValue;
  source: string;
}

export interface AskMetrics {
  catalogBuildMs: number | null;
  parseMs?: number;
  sqlExecutionMs?: number;
  totalAskMs?: number;
}

export interface ClarificationChoice {
  label: string;
  fieldId: string;
  fieldLabel?: string;
  table?: string;
  column?: string;
  value?: CellValue;
  valueNormalized?: string;
}

export interface ClarificationPending {
  slot: 'field' | 'filterField';
  originalQuestion: string | null;
  phrase?: string;
  roles?: FieldRole[];
  fieldId?: string;
  value?: CellValue;
  valueNormalized?: string;
  candidates?: ClarificationChoice[];
}

export interface ParseOptions {
  clarification?: ClarificationPending;
}

export interface Clarification {
  message: string;
  pending: ClarificationPending;
  choices: ClarificationChoice[];
}

export interface Narrative {
  type: 'trend' | 'outlier' | 'pattern' | 'comparison' | 'distribution' | 'summary';
  title: string;
  text: string;
  importance: number;
  details?: Record<string, unknown>;
}

export interface NarrativeResult {
  narratives: Narrative[];
  summary: string;
  keyTakeaway: string;
}

export interface AskSuccessResult {
  question: string;
  interpretation: string;
  intent: AskIntent;
  sql: string;
  rows: DataRow[];
  columns: string[];
  shape: ResultShape;
  diagnostics: Diagnostics;
  chartDecision: ChartDecision;
  insights: string[];
  narratives?: NarrativeResult | null;
  evidence: EvidenceItem[];
  chartType: AskChartType;
  warnings: string[];
  confidence: number;
  metrics: AskMetrics;
}

export interface AskErrorResult {
  error: string;
  suggestions?: string[];
  metrics?: AskMetrics;
}

export interface AskClarificationResult {
  clarification: Clarification;
  metrics?: AskMetrics;
}

export type AskResult = AskSuccessResult | AskErrorResult | AskClarificationResult;

export interface PlannedSql {
  sql?: string;
  columns?: string[];
  metricFormat?: ValueFormat;
  diagnostics?: Diagnostics | null;
  error?: string;
}

export interface JoinPlanResult {
  error?: string;
  joins?: Relationship[];
}

export interface JoinPlanProvider {
  buildJoinPlan(baseTable: string, neededTables: string[]): JoinPlanResult;
}

export type WhereCondition =
  | { kind: 'eq'; tableAlias: string; column: string; value: CellValue }
  | { kind: 'in'; tableAlias: string; column: string; values: CellValue[] }
  | { kind: 'date_range'; dateExpr: string; start: string; end: string }
  | { kind: 'month_of_year'; dateExpr: string; month: number };

export interface FieldSearchItem {
  field: CatalogField;
  text: string;
  activeLabel: string;
  activeSynonyms: string[];
  label: string;
  column: string;
  synonyms: string[];
  allSynonyms: string[];
  role: FieldRole;
}

export interface ValueItem {
  value: string;
  normalizedValue: string;
  field: CatalogField;
  matchScore?: number;
  matchSource?: string;
}

export type FieldFuse = Fuse<FieldSearchItem>;
export type ValueFuse = Fuse<ValueItem>;
export type FieldSearchIndexType = MiniSearch<{ id: string; role: FieldRole; text: string }>;
