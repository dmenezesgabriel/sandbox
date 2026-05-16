import { parse, stringify } from 'yaml';

import type { DataSourceConfig, DataSourceType } from '../../../shared/types/index';

type RawDatasourceYaml = Record<string, unknown>;

class DatasourceYamlValidationError extends Error {}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DatasourceYamlValidationError(
      `Datasource YAML: "${field}" must be a non-empty string`,
    );
  }
  return value as string;
}

const VALID_TYPES = new Set<DataSourceType>(['csv', 'parquet', 'json']);

function inferTypeFromUrl(url: string): DataSourceType {
  const lower = url.toLowerCase();
  if (lower.endsWith('.parquet')) return 'parquet';
  if (lower.endsWith('.json')) return 'json';
  return 'csv';
}

export function parseDatasourceYaml(
  raw: string,
): Omit<DataSourceConfig, 'id' | 'slug' | 'source' | 'createdAt' | 'updatedAt'> {
  const data = parse(raw) as RawDatasourceYaml;
  if (!data || typeof data !== 'object') {
    throw new DatasourceYamlValidationError('Datasource YAML: file must be a YAML object');
  }

  const name = assertString(data['name'], 'name');
  const url = assertString(data['url'], 'url');

  const rawType = data['type'];
  const type: DataSourceType =
    rawType && VALID_TYPES.has(rawType as DataSourceType)
      ? (rawType as DataSourceType)
      : inferTypeFromUrl(url);

  return {
    name,
    url,
    type,
    description: typeof data['description'] === 'string' ? data['description'] : undefined,
  };
}

export function serializeDatasourceYaml(ds: DataSourceConfig): string {
  const doc: RawDatasourceYaml = {
    name: ds.name,
    type: ds.type,
    url: ds.url,
  };
  if (ds.description) doc['description'] = ds.description;
  return stringify(doc, { indent: 2 });
}
