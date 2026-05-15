import type { ChartConfiguration, ChartType } from 'chart.js';

import type {
  AskSuccessResult,
  CatalogField,
  CellValue,
  DataRow,
  ValueFormat,
} from '../../../../shared/types/index';
import { formatValue, numberValue } from '../../../../shared/utils/utils';

export type RenderableAskChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'histogram';

const RENDERABLE_CHARTS: RenderableAskChartType[] = [
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'bubble',
  'histogram',
];

const CHART_COLORS = [
  '#c9613f',
  '#4a8c6f',
  '#2d6a8f',
  '#c8963e',
  '#8b6f9e',
  '#d9756a',
  '#6bb5a0',
  '#b89b6b',
] as const;

export function isRenderableAskChartType(
  value: string | undefined,
): value is RenderableAskChartType {
  return value !== undefined && RENDERABLE_CHARTS.includes(value as RenderableAskChartType);
}

export function toAskResultChartJsType(type: RenderableAskChartType): ChartType {
  if (type === 'area') return 'line';
  if (type === 'donut') return 'doughnut';
  if (type === 'histogram') return 'bar';
  return type;
}

export function buildAskResultChartConfig(result: AskSuccessResult): ChartConfiguration | null {
  if (!isRenderableAskChartType(result.chartType)) return null;
  const rows = result.rows || [];
  if (result.chartType === 'scatter' || result.chartType === 'bubble') {
    return buildScatterConfig(result, result.chartType, rows);
  }
  if (result.chartType === 'histogram') {
    return buildHistogramConfig(result, rows);
  }
  return buildDefaultConfig(result, result.chartType, rows);
}

function buildDefaultConfig(
  result: AskSuccessResult,
  chartType: RenderableAskChartType,
  rows: DataRow[],
): ChartConfiguration {
  return {
    type: toAskResultChartJsType(chartType),
    data: {
      labels: rows.map((row) => String(row.label)),
      datasets: [
        {
          label: result.interpretation,
          data: rows.map((row) => numberValue(row.value)),
          fill: chartType === 'area',
          borderColor: '#c9613f',
          backgroundColor: chartType === 'area' ? '#c9613f33' : [...CHART_COLORS],
        },
      ],
    },
    options: {
      responsive: true,
      scales: chartType === 'bar' ? { y: { beginAtZero: true } } : {},
      plugins: { legend: { display: ['pie', 'donut'].includes(chartType) } },
    },
  };
}

function buildScatterConfig(
  result: AskSuccessResult,
  chartType: 'scatter' | 'bubble',
  rows: DataRow[],
): ChartConfiguration | null {
  const [xKey, yKey, rKey] = result.shape?.numeric || [];
  if (!xKey || !yKey) return null;
  return {
    type: chartType,
    data: {
      datasets: [
        {
          label: result.interpretation,
          data: rows.map((row) => ({
            x: numberValue(row[xKey]),
            y: numberValue(row[yKey]),
            r: Math.max(3, Math.sqrt(Math.abs(numberValue(row[rKey])) || 9)),
          })),
          backgroundColor: '#c9613f88',
          borderColor: '#c9613f',
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: xKey } },
        y: { title: { display: true, text: yKey } },
      },
    },
  };
}

function buildHistogramConfig(
  result: AskSuccessResult,
  rows: DataRow[],
): ChartConfiguration | null {
  const key = result.shape?.numeric?.[0] || 'value';
  const values = rows.map((row) => numberValue(row[key])).filter(Number.isFinite);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(12, Math.max(3, Math.ceil(Math.sqrt(values.length))));
  const step = (max - min || 1) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({ start: min + i * step, count: 0 }));
  for (const value of values) {
    bins[Math.min(binCount - 1, Math.floor((value - min) / step))].count++;
  }
  return {
    type: 'bar',
    data: {
      labels: bins.map((bin) => `${bin.start.toFixed(0)}–${(bin.start + step).toFixed(0)}`),
      datasets: [{ label: key, data: bins.map((bin) => bin.count), backgroundColor: '#c9613f' }],
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  };
}

export function askResultToCsv(result: AskSuccessResult): string {
  const columns = result.columns || [];
  const escape = (value: CellValue): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    columns.map(escape).join(','),
    ...(result.rows || []).map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n');
}

export function formatAskResultCell(
  column: string,
  value: CellValue,
  metricFormat?: ValueFormat,
): string {
  if (value === null || value === undefined || value === '') return '';
  if (String(column).includes('percent') || column === 'share')
    return formatValue(value, 'percent');
  if (['value', 'previous_value', 'start_value', 'end_value', 'change'].includes(column)) {
    return formatValue(value, metricFormat);
  }
  return String(value);
}

export function resolveAskResultMetric(result: AskSuccessResult): CatalogField | undefined {
  const intentMetric = result.intent.metric;
  if (intentMetric && 'table' in intentMetric) return intentMetric;
  if (intentMetric && 'kind' in intentMetric && intentMetric.kind === 'count_distinct') {
    return intentMetric.field;
  }
  return undefined;
}

export function importanceBadgeLabel(importance: number): string | null {
  if (importance >= 9) return 'Critical';
  if (importance >= 8) return 'High';
  if (importance >= 7) return 'Notable';
  return null;
}
