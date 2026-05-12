import type { DataSourceConfig } from './types';
import { escapeSqlString, quoteIdent } from './utils';

export interface DataSourceManager {
  createViews(sources: DataSourceConfig[]): Promise<void>;
}

export class DuckDBDataSourceManager implements DataSourceManager {
  private db: { query: (sql: string) => Promise<unknown> };

  constructor(db: { query: (sql: string) => Promise<unknown> }) {
    this.db = db;
  }

  async createViews(sources: DataSourceConfig[]): Promise<void> {
    for (const source of sources) {
      await this.db.query(
        `CREATE OR REPLACE VIEW ${quoteIdent(source.name)} AS SELECT * FROM read_csv_auto('${escapeSqlString(source.url)}')`,
      );
    }
  }
}
