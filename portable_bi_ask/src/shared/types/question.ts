import type { ChartType2, WidgetType } from './dashboard';

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
  nlQuery?: string;
  queryType?: 'nl' | 'sql';
  columns?: string[];
  columnFormats?: Record<string, string>;
  options?: Record<string, unknown>;

  // Datasource references by slug
  dataSourceSlugs?: string[];

  // Registry metadata
  source: 'yaml' | 'user';
  createdAt: string;
  updatedAt: string;
}
