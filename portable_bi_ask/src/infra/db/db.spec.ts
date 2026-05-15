import { describe, expect, it, vi } from 'vitest';

import type { QueryPort } from '../query/query-port';
import { DuckDBManager } from './db';

describe('QueryPort', () => {
  it('DuckDBManager satisfies the QueryPort interface', () => {
    const manager: QueryPort = new DuckDBManager() as QueryPort;
    expect(typeof manager.query).toBe('function');
  });

  it('allows a mock QueryPort to be used in place of DuckDBManager', async () => {
    const mock: QueryPort = {
      query: vi.fn(async (sql: string) => [{ col: sql }]),
    };
    const result = await mock.query('SELECT 1');
    expect(result).toEqual([{ col: 'SELECT 1' }]);
  });
});
