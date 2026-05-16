export type DataSourceType = 'csv' | 'parquet' | 'json';

export interface DataSourceConfig {
  id: string;
  slug: string;
  name: string;
  description?: string;
  type: DataSourceType;
  url: string;
  source: 'yaml' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface LegacyDataSourceConfig {
  name: string;
  url: string;
}
