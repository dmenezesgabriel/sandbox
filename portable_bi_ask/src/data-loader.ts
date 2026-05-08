import type {
  CellValue,
  ChartDataResult,
  DashboardDataLoaderOptions,
  DashboardRefreshResult,
  DataRow,
  FilterOptions,
  Filters,
} from './types';
import { escapeSqlString, numberValue, quoteIdent, toRows } from './utils';

export class DashboardDataLoader {
  private readonly config: DashboardDataLoaderOptions['config'];
  private readonly duckDBManager: DashboardDataLoaderOptions['duckDBManager'];
  private readonly askEngine: DashboardDataLoaderOptions['askEngine'];
  private dataReady = false;

  constructor({ config, duckDBManager, askEngine }: DashboardDataLoaderOptions) {
    this.config = config;
    this.duckDBManager = duckDBManager;
    this.askEngine = askEngine;
  }

  async ensureDataReady(): Promise<void> {
    if (this.dataReady) return;
    for (const source of this.config.dataSources) {
      await this.duckDBManager.query(
        `CREATE OR REPLACE VIEW ${quoteIdent(source.name)} AS SELECT * FROM read_csv_auto('${escapeSqlString(source.url)}')`,
      );
    }
    await this.askEngine.initialize();
    this.dataReady = true;
  }

  async loadFilterOptions(
    filters: Filters,
  ): Promise<{ filterOptions: FilterOptions; filters: Filters }> {
    const filterOptions: FilterOptions = {};
    const nextFilters: Filters = { ...filters };
    for (const filter of this.config.filters) {
      const sql = `SELECT DISTINCT ${quoteIdent(filter.source.column)} AS val FROM ${quoteIdent(filter.source.table)} ORDER BY val`;
      const result = await this.duckDBManager.query(sql);
      const options = toRows(result).map((row) => String(row.val));
      options.unshift('All');
      filterOptions[filter.field] = options;
      if (!nextFilters[filter.field]) nextFilters[filter.field] = 'All';
    }
    return { filterOptions, filters: nextFilters };
  }

  async refresh(filters: Filters): Promise<DashboardRefreshResult> {
    return {
      kpiResults: await this.loadKpis(filters),
      chartData: await this.loadCharts(filters),
      tableRows: await this.loadTables(filters),
    };
  }

  async loadKpis(filters: Filters): Promise<CellValue[]> {
    const results: CellValue[] = [];
    for (const kpi of this.config.kpis) {
      const result = await this.duckDBManager.query(this.applyFilters(kpi.query, filters));
      results.push(toRows(result)[0]?.value);
    }
    return results;
  }

  async loadCharts(filters: Filters): Promise<ChartDataResult[]> {
    const chartData: ChartDataResult[] = [];
    for (const chartDef of this.config.charts) {
      const result = await this.duckDBManager.query(this.applyFilters(chartDef.query, filters));
      const rows = toRows(result);
      chartData.push({
        chartDef,
        labels: rows.map((row) => String(row.label)),
        data: rows.map((row) => numberValue(row.value)),
      });
    }
    return chartData;
  }

  async loadTables(filters: Filters): Promise<DataRow[][]> {
    const tableRows: DataRow[][] = [];
    for (const tableDef of this.config.tables) {
      const result = await this.duckDBManager.query(this.applyFilters(tableDef.query, filters));
      tableRows.push(toRows(result));
    }
    return tableRows;
  }

  extractTableAliases(query: string): Record<string, string> {
    const aliases: Record<string, string> = {};
    const keywords = new Set([
      'where',
      'join',
      'on',
      'using',
      'group',
      'order',
      'limit',
      'left',
      'right',
      'inner',
      'outer',
      'full',
      'cross',
    ]);
    const re = /\b(?:from|join)\s+"?([a-zA-Z_]\w*)"?(?:\s+(?:as\s+)?"?([a-zA-Z_]\w*)"?)?/gi;
    for (const match of query.matchAll(re)) {
      const [, table, alias] = match;
      if (table && alias && !keywords.has(alias.toLowerCase())) aliases[table] = alias;
    }
    return aliases;
  }

  applyFilters(query: string, filters: Filters): string {
    const aliasMap = this.extractTableAliases(query);
    let sql = query;
    for (const filter of this.config.filters || []) {
      const placeholder = `--filter:${filter.field}--`;
      if (!sql.includes(placeholder)) continue;
      const value = filters[filter.field] || 'All';
      const tableRef = quoteIdent(aliasMap[filter.source.table] || filter.source.table);
      const filterExpr =
        value && value !== 'All'
          ? `${tableRef}.${quoteIdent(filter.source.column)} = '${escapeSqlString(value)}'`
          : '1=1';
      sql = sql.replaceAll(placeholder, filterExpr);
    }
    return sql;
  }
}
