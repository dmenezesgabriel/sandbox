import { describe, expect, it } from 'vitest';

import { createEmptyDatasourceConfig } from './datasource-config';
import { parseDatasourceYaml, serializeDatasourceYaml } from './datasource-yaml';

const VALID_YAML = `
name: Sales Data
type: csv
url: 'https://example.com/sales.csv'
description: Monthly sales
`;

describe('parseDatasourceYaml', () => {
  it('parses a minimal valid YAML string', () => {
    const ds = parseDatasourceYaml(VALID_YAML);
    expect(ds.name).toBe('Sales Data');
    expect(ds.url).toBe('https://example.com/sales.csv');
    expect(ds.type).toBe('csv');
    expect(ds.description).toBe('Monthly sales');
  });

  it('throws when name is missing', () => {
    const bad = `type: csv\nurl: 'https://example.com/sales.csv'`;
    expect(() => parseDatasourceYaml(bad)).toThrow();
  });

  it('throws when url is missing', () => {
    const bad = `name: Sales\ntype: csv`;
    expect(() => parseDatasourceYaml(bad)).toThrow();
  });

  it('infers type csv when type is omitted', () => {
    const yaml = `name: X\nurl: 'https://example.com/data.csv'`;
    const ds = parseDatasourceYaml(yaml);
    expect(ds.type).toBe('csv');
  });

  it('infers type parquet from url extension', () => {
    const yaml = `name: X\nurl: 'https://example.com/data.parquet'`;
    const ds = parseDatasourceYaml(yaml);
    expect(ds.type).toBe('parquet');
  });

  it('infers type json from url extension', () => {
    const yaml = `name: X\nurl: 'https://example.com/data.json'`;
    const ds = parseDatasourceYaml(yaml);
    expect(ds.type).toBe('json');
  });

  it('uses explicit type over inferred type', () => {
    const yaml = `name: X\ntype: parquet\nurl: 'https://example.com/data.csv'`;
    const ds = parseDatasourceYaml(yaml);
    expect(ds.type).toBe('parquet');
  });

  it('omits description when not present', () => {
    const yaml = `name: X\nurl: 'https://example.com/data.csv'`;
    const ds = parseDatasourceYaml(yaml);
    expect(ds.description).toBeUndefined();
  });

  it('throws on non-object YAML', () => {
    expect(() => parseDatasourceYaml('just a string')).toThrow();
  });
});

describe('serializeDatasourceYaml', () => {
  it('round-trips through parse and serialize', () => {
    const partial = parseDatasourceYaml(VALID_YAML);
    const now = new Date().toISOString();
    const ds = createEmptyDatasourceConfig({ ...partial, createdAt: now, updatedAt: now });
    const serialized = serializeDatasourceYaml(ds);
    const reparsed = parseDatasourceYaml(serialized);
    expect(reparsed.name).toBe(ds.name);
    expect(reparsed.url).toBe(ds.url);
    expect(reparsed.type).toBe(ds.type);
    expect(reparsed.description).toBe(ds.description);
  });

  it('omits undefined description', () => {
    const ds = createEmptyDatasourceConfig({ name: 'X', url: 'https://x.com/f.csv' });
    const serialized = serializeDatasourceYaml(ds);
    expect(serialized).not.toContain('description');
  });

  it('includes description when set', () => {
    const ds = createEmptyDatasourceConfig({
      name: 'X',
      url: 'https://x.com/f.csv',
      description: 'my desc',
    });
    const serialized = serializeDatasourceYaml(ds);
    expect(serialized).toContain('my desc');
  });
});
