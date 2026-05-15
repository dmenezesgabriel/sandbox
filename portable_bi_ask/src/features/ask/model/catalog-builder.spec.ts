import { describe, expect, it, vi } from 'vitest';

import type { QueryPort } from '../../../infra/query/query-port';
import { CatalogBuilder } from './catalog-builder';

function makeQueryPort(handler: (sql: string) => unknown[]): QueryPort {
  return { query: vi.fn(async (sql: string) => handler(sql)) };
}

const noopTimeSql = (field: { column: string }, alias: string) =>
  `CAST(${alias}."${field.column}" AS DATE)`;

const baseArgs = {
  fieldByKey: new Map(),
  displayLabel: () => '',
  localizedTerms: () => [] as string[],
  timeSqlExpression: noopTimeSql,
};

describe('CatalogBuilder', () => {
  describe('build', () => {
    it('returns a measure field for a numeric column without requiring DuckDB WASM', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 100 }];
        if (sql.includes('DESCRIBE')) return [{ column_name: 'amount', column_type: 'DOUBLE' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 50 }];
        return [{ v: 10.5 }];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'sales' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      const { catalog } = await builder.build();

      expect(catalog).toHaveLength(1);
      expect(catalog[0]).toMatchObject({
        table: 'sales',
        column: 'amount',
        type: 'DOUBLE',
        role: 'measure',
        rowCount: 100,
        cardinality: 50,
      });
    });

    it('returns a dimension field with sample values for a low-cardinality text column', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 50 }];
        if (sql.includes('DESCRIBE')) return [{ column_name: 'category', column_type: 'VARCHAR' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 3 }];
        return [{ v: 'books' }, { v: 'games' }, { v: 'music' }];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'products' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      const { catalog } = await builder.build();

      expect(catalog[0]).toMatchObject({ column: 'category', role: 'dimension' });
      expect(catalog[0].sampleValues).toEqual(expect.arrayContaining(['books', 'games', 'music']));
    });

    it('queries the QueryPort for each column in each data source', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 10 }];
        if (sql.includes('DESCRIBE'))
          return [
            { column_name: 'amount', column_type: 'DOUBLE' },
            { column_name: 'category', column_type: 'VARCHAR' },
          ];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 5 }];
        return [];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'orders' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      await builder.build();

      // COUNT(*) + DESCRIBE + 2 columns × (sample + distinct) = 6 minimum
      expect((db.query as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(6);
    });

    it('populates fieldByKey with built fields indexed by table::column', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 5 }];
        if (sql.includes('DESCRIBE')) return [{ column_name: 'price', column_type: 'FLOAT' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 5 }];
        return [];
      });

      const fieldByKey = new Map();
      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'items' }] },
        duckDBManager: db,
        fieldByKey,
      });

      await builder.build();

      expect(fieldByKey.has('items::price')).toBe(true);
      expect(fieldByKey.get('items::price')).toMatchObject({ column: 'price', table: 'items' });
    });

    it('infers a time role for columns with date-like names', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 20 }];
        if (sql.includes('DESCRIBE'))
          return [{ column_name: 'order_date', column_type: 'VARCHAR' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 10 }];
        if (sql.includes('min_date')) return [{ min_date: '2023-01-01', max_date: '2024-12-31' }];
        return [{ v: '2024-01-15' }];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'orders' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      const { catalog } = await builder.build();

      expect(catalog[0]).toMatchObject({ column: 'order_date', role: 'time' });
      expect(catalog[0].dateProfile).not.toBeNull();
    });

    it('infers dimension for a low-cardinality numeric field', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 1000 }];
        if (sql.includes('DESCRIBE')) return [{ column_name: 'priority', column_type: 'INTEGER' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 3 }];
        return [{ v: 1 }, { v: 2 }, { v: 3 }];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'tasks' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      const { catalog } = await builder.build();

      expect(catalog[0]).toMatchObject({ column: 'priority', role: 'dimension' });
    });

    it('applies config override role over the detected role', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 1000 }];
        if (sql.includes('DESCRIBE')) return [{ column_name: 'priority', column_type: 'INTEGER' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 3 }];
        return [{ v: 1 }, { v: 2 }, { v: 3 }];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'tasks' }] },
        askConfig: { fields: [{ table: 'tasks', column: 'priority', role: 'measure' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      const { catalog } = await builder.build();

      expect(catalog[0]).toMatchObject({ column: 'priority', role: 'measure' });
    });

    it('builds fields across multiple data sources', async () => {
      const db = makeQueryPort((sql) => {
        if (sql.includes('COUNT(*)')) return [{ row_count: 10 }];
        if (sql.includes('DESCRIBE')) return [{ column_name: 'value', column_type: 'INTEGER' }];
        if (sql.includes('COUNT(DISTINCT')) return [{ distinct_count: 10 }];
        return [];
      });

      const builder = new CatalogBuilder({
        ...baseArgs,
        config: { dataSources: [{ name: 'tableA' }, { name: 'tableB' }] },
        duckDBManager: db,
        fieldByKey: new Map(),
      });

      const { catalog } = await builder.build();

      expect(catalog).toHaveLength(2);
      expect(catalog.map((f) => f.table)).toEqual(expect.arrayContaining(['tableA', 'tableB']));
    });
  });
});
