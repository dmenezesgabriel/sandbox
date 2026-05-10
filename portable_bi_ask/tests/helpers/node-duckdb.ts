import duckdb from 'duckdb';

// Thin adapter that wraps the native Node.js DuckDB package behind the same
// .query() interface that DuckDBManager (browser/WASM) exposes.  The return
// shape { rows: [...] } is understood by toRows() in src/utils.ts.
export class NodeDuckDBManager {
  private readonly conn: duckdb.Connection;

  constructor() {
    const db = new duckdb.Database(':memory:');
    this.conn = db.connect();
  }

  query(sql: string): Promise<{ rows: Record<string, unknown>[] }> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, (err, rows) => {
        if (err) reject(new Error(`${err.message}\nSQL: ${sql}`));
        else resolve({ rows: (rows as Record<string, unknown>[]) ?? [] });
      });
    });
  }

  // For DDL / INSERT used in test setup only.
  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(sql, (err) => {
        if (err) reject(new Error(`${err.message}\nSQL: ${sql}`));
        else resolve();
      });
    });
  }
}
