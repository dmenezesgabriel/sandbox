import type { ChartConfiguration, ChartType } from 'chart.js';

import type { AskDataConfig, Relationship, SourceColumnRef } from './ask';

export interface DashboardFilterConfig {
  field: string;
  label: string;
  source: SourceColumnRef;
  type: 'select' | string;
}

export interface KpiConfig {
  id: string;
  title: string;
  query: string;
  format?: 'currency';
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  query: string;
  title?: string;
  options?: ChartConfiguration['options'];
  section?: string;
}

export interface TableConfig {
  id: string;
  title: string;
  query: string;
  columns: string[];
  columnFormats?: Record<string, 'currency'>;
}

export interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WidgetType = 'chart' | 'table' | 'kpi' | 'text' | 'image' | 'filter';
export type ChartType2 =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'gauge'
  | 'funnel';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  query?: string;
  queryType?: 'nl' | 'sql';
  chartType?: ChartType2;
  columns?: string[];
  columnFormats?: Record<string, 'currency'>;
  kpiConfig?: KpiConfig;
  textContent?: string;
  filters?: DashboardFilterConfig[];
  crossFilterFields?: string[];
  options?: Record<string, unknown>;
  backgroundColor?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  type: 'layout' | 'dashboard';
  widgets: WidgetConfig[];
  layout: Position[];
  filters?: DashboardFilterConfig[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardConfig {
  title: string;
  subtitle: string;
  dataSourceSlugs?: string[];
  askData: AskDataConfig;
  filters: DashboardFilterConfig[];
  kpis: KpiConfig[];
  charts: ChartConfig[];
  tables: TableConfig[];
  layout?: Position[];
  relationships?: Relationship[];
}
