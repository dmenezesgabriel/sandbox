import type { ChartType2, WidgetType } from './dashboard';
import type { DataSourceConfig } from './data-source';

export interface QuestionConfig {
  // Identity
  id: string;
  slug: string;
  title: string;
  description?: string;

  // Visualization (mirrors WidgetConfig fields)
  type: WidgetType;
  chartType?: ChartType2;
  query?: string;
  queryType?: 'nl' | 'sql';
  columns?: string[];
  columnFormats?: Record<string, string>;
  options?: Record<string, unknown>;

  // Standalone data sources (optional — used for preview only)
  dataSources?: DataSourceConfig[];

  // Registry metadata
  source: 'yaml' | 'user';
  createdAt: string;
  updatedAt: string;
}
