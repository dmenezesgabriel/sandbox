import { parse, stringify } from 'yaml';

import type { QuestionConfig } from '../../../shared/types/index';

type RawQuestionYaml = Record<string, unknown>;

class QuestionYamlValidationError extends Error {}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new QuestionYamlValidationError(`Question YAML: "${field}" must be a non-empty string`);
  }
  return value as string;
}

const VALID_TYPES = new Set(['chart', 'table', 'kpi', 'text']);
const VALID_CHART_TYPES = new Set([
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'bubble',
  'histogram',
  'gauge',
  'funnel',
]);

export function parseQuestionYaml(raw: string): QuestionConfig {
  const data = parse(raw) as RawQuestionYaml;
  if (!data || typeof data !== 'object') {
    throw new QuestionYamlValidationError('Question YAML: file must be a YAML object');
  }

  const id = assertString(data['id'], 'id');
  const slug = assertString(data['slug'] ?? data['id'], 'slug');
  const title = assertString(data['title'], 'title');
  const type = assertString(data['type'], 'type');

  if (!VALID_TYPES.has(type)) {
    throw new QuestionYamlValidationError(
      `Question YAML: "type" must be one of ${[...VALID_TYPES].join(', ')}`,
    );
  }

  const chartType = data['chartType'] as string | undefined;
  if (chartType && !VALID_CHART_TYPES.has(chartType)) {
    throw new QuestionYamlValidationError(
      `Question YAML: "chartType" must be one of ${[...VALID_CHART_TYPES].join(', ')}`,
    );
  }

  const now = new Date().toISOString();
  return {
    id,
    slug,
    title,
    description: typeof data['description'] === 'string' ? data['description'] : undefined,
    type: type as QuestionConfig['type'],
    chartType: chartType as QuestionConfig['chartType'],
    queryType: (data['queryType'] as QuestionConfig['queryType']) ?? 'sql',
    query: typeof data['query'] === 'string' ? data['query'] : undefined,
    columns: Array.isArray(data['columns']) ? (data['columns'] as string[]) : undefined,
    columnFormats: data['columnFormats'] as Record<string, string> | undefined,
    options: data['options'] as Record<string, unknown> | undefined,
    dataSourceSlugs: Array.isArray(data['dataSourceSlugs'])
      ? (data['dataSourceSlugs'] as string[])
      : undefined,
    source: 'yaml',
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeQuestionYaml(q: QuestionConfig): string {
  const doc: RawQuestionYaml = {
    id: q.id,
    slug: q.slug,
    title: q.title,
  };
  if (q.description) doc['description'] = q.description;
  if (q.type) doc['type'] = q.type;
  if (q.chartType) doc['chartType'] = q.chartType;
  if (q.queryType) doc['queryType'] = q.queryType;
  if (q.query) doc['query'] = q.query;
  if (q.columns) doc['columns'] = q.columns;
  if (q.columnFormats) doc['columnFormats'] = q.columnFormats;
  if (q.options) doc['options'] = q.options;
  if (q.dataSourceSlugs?.length) doc['dataSourceSlugs'] = q.dataSourceSlugs;
  return stringify(doc, { indent: 2 });
}
