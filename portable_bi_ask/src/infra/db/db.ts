import * as duckdb from '@duckdb/duckdb-wasm';
import type { Table } from 'apache-arrow';

import type { QueryPort } from '../query/query-port';

export class DuckDBManager implements QueryPort {
  private dbInstance: duckdb.AsyncDuckDB | null = null;
  private dbConnection: duckdb.AsyncDuckDBConnection | null = null;

  async initialize(): Promise<duckdb.AsyncDuckDB> {
    if (this.dbInstance) return this.dbInstance;
    const jsDelivrBundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(jsDelivrBundles);
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
    );
    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    this.dbInstance = db;
    this.dbConnection = await db.connect();
    return db;
  }

  async getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
    await this.initialize();
    if (!this.dbConnection) throw new Error('DuckDB connection was not initialized.');
    return this.dbConnection;
  }

  async query(sql: string): Promise<Table<Record<string, never>>> {
    const connection = await this.getConnection();
    return connection.query<Record<string, never>>(sql);
  }
}

export const duckDBManager = new DuckDBManager();
