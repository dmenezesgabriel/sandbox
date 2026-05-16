import { describe, expect, it, vi } from 'vitest';

import type { DataSourceEntry } from './data-source-manager';
import { DuckDBDataSourceManager } from './data-source-manager';

describe('DataSourceManager port', () => {
  describe('DuckDBDataSourceManager', () => {
    it('creates a VIEW for each data source via the query interface', async () => {
      const queries: string[] = [];
      const mockDb = {
        query: vi.fn(async (sql: string) => {
          queries.push(sql);
        }),
      };

      const manager = new DuckDBDataSourceManager(mockDb);
      const sources: DataSourceEntry[] = [
        { name: 'sales', url: 'https://example.com/sales.csv' },
        { name: 'customer', url: 'https://example.com/customer.csv' },
      ];

      await manager.createViews(sources);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(queries[0]).toContain('sales');
      expect(queries[0]).toContain('read_csv_auto');
      expect(queries[0]).toContain('https://example.com/sales.csv');
      expect(queries[1]).toContain('customer');
      expect(queries[1]).toContain('https://example.com/customer.csv');
    });

    it('escapes SQL identifiers and values in view creation', async () => {
      const queries: string[] = [];
      const mockDb = {
        query: vi.fn(async (sql: string) => {
          queries.push(sql);
        }),
      };

      const manager = new DuckDBDataSourceManager(mockDb);
      const sources: DataSourceEntry[] = [{ name: 'my "table"', url: "it's a url" }];

      await manager.createViews(sources);

      expect(queries[0]).toContain('"my ""table"""');
      expect(queries[0]).toContain("'it''s a url'");
    });

    it('throws when view creation fails', async () => {
      const mockDb = {
        query: vi.fn(async () => {
          throw new Error('connection failed');
        }),
      };

      const manager = new DuckDBDataSourceManager(mockDb);
      const sources: DataSourceEntry[] = [{ name: 'sales', url: 'bad' }];

      await expect(manager.createViews(sources)).rejects.toThrow('connection failed');
    });

    it('creates no views for an empty data source list', async () => {
      const mockDb = { query: vi.fn(async () => {}) };
      const manager = new DuckDBDataSourceManager(mockDb);

      await manager.createViews([]);

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
