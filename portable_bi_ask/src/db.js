import * as duckdb from '@duckdb/duckdb-wasm';

export class DuckDBManager {
  constructor() {
    this.dbInstance = null;
    this.dbConnection = null;
  }
  async initialize() {
    if (this.dbInstance) return this.dbInstance;
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts(\"${bundle.mainWorker}\");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    this.dbInstance = db;
    this.dbConnection = await db.connect();
    return db;
  }
  async getConnection() {
    await this.initialize();
    return this.dbConnection;
  }
  async query(sql) {
    const connection = await this.getConnection();
    return connection.query(sql);
  }
}
export const duckDBManager = new DuckDBManager();
