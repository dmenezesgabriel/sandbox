import { escapeSqlString, numberValue, quoteIdent, toRows } from './utils.js';

export class DashboardDataLoader {
  constructor({ config, duckDBManager, askEngine }) {
    this.config = config;
    this.duckDBManager = duckDBManager;
    this.askEngine = askEngine;
    this.dataReady = false;
  }

  async ensureDataReady() {
    if (this.dataReady) return;
    for (const source of this.config.dataSources) {
      await this.duckDBManager.query(`CREATE OR REPLACE VIEW ${quoteIdent(source.name)} AS SELECT * FROM read_csv_auto('${escapeSqlString(source.url)}')`);
    }
    await this.askEngine.initialize();
    this.dataReady = true;
  }

  async loadFilterOptions(filters) {
    const filterOptions = {};
    const nextFilters = { ...filters };
    for (const filter of this.config.filters) {
      const sql = `SELECT DISTINCT ${quoteIdent(filter.source.column)} AS val FROM ${quoteIdent(filter.source.table)} ORDER BY val`;
      const result = await this.duckDBManager.query(sql);
      const options = toRows(result).map(row => row.val);
      options.unshift('All');
      filterOptions[filter.field] = options;
      if (!nextFilters[filter.field]) nextFilters[filter.field] = 'All';
    }
    return { filterOptions, filters: nextFilters };
  }

  async refresh(filters) {
    return {
      kpiResults: await this.loadKpis(filters),
      chartData: await this.loadCharts(filters),
      tableRows: await this.loadTables(filters)
    };
  }

  async loadKpis(filters) {
    const results = [];
    for (const kpi of this.config.kpis) {
      const result = await this.duckDBManager.query(this.applyFilters(kpi.query, filters));
      results.push(toRows(result)[0]?.value);
    }
    return results;
  }

  async loadCharts(filters) {
    const chartData = [];
    for (const chartDef of this.config.charts) {
      const result = await this.duckDBManager.query(this.applyFilters(chartDef.query, filters));
      const rows = toRows(result);
      chartData.push({ chartDef, labels: rows.map(row => String(row.label)), data: rows.map(row => numberValue(row.value)) });
    }
    return chartData;
  }

  async loadTables(filters) {
    const tableRows = [];
    for (const tableDef of this.config.tables) {
      const result = await this.duckDBManager.query(this.applyFilters(tableDef.query, filters));
      tableRows.push(toRows(result));
    }
    return tableRows;
  }

  extractTableAliases(query) {
    const aliases = {};
    const keywords = new Set(['where', 'join', 'on', 'using', 'group', 'order', 'limit', 'left', 'right', 'inner', 'outer', 'full', 'cross']);
    const re = /\b(?:from|join)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?(?:\s+(?:as\s+)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?)?/gi;
    for (const match of query.matchAll(re)) {
      const [, table, alias] = match;
      if (alias && !keywords.has(alias.toLowerCase())) aliases[table] = alias;
    }
    return aliases;
  }

  applyFilters(query, filters) {
    const aliasMap = this.extractTableAliases(query);
    let sql = query;
    for (const filter of (this.config.filters || [])) {
      const placeholder = `--filter:${filter.field}--`;
      if (!sql.includes(placeholder)) continue;
      const value = filters[filter.field] || 'All';
      const tableRef = quoteIdent(aliasMap[filter.source.table] || filter.source.table);
      const filterExpr = (value && value !== 'All') ? `${tableRef}.${quoteIdent(filter.source.column)} = '${escapeSqlString(value)}'` : '1=1';
      sql = sql.replaceAll(placeholder, filterExpr);
    }
    return sql;
  }
}
