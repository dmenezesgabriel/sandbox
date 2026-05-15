import type {
  CatalogField,
  Diagnostics,
  PlannedSql,
  Relationship,
  WhereCondition,
} from '../../../shared/types/index';
import { quoteIdent, safeAlias } from '../../../shared/utils/utils';
import { SqlRenderer } from './sql-renderer';

export class SqlPlanner {
  config: { dataSources?: Array<{ name: string }>; relationships?: Relationship[] };
  askConfig: {
    maxRows?: number;
    maxDimensions?: number;
    validation?: {
      joinFanoutRatio?: number;
      joinFanoutMinExtraRows?: number;
      filterSelectivityRatio?: number;
    };
  };
  relationships: () => Relationship[];
  getDefaultTimeField: () => CatalogField | undefined;

  constructor({
    config,
    askConfig,
    relationships,
    getDefaultTimeField,
  }: {
    config: SqlPlanner['config'];
    askConfig?: SqlPlanner['askConfig'];
    relationships: SqlPlanner['relationships'];
    getDefaultTimeField: SqlPlanner['getDefaultTimeField'];
  }) {
    this.config = config;
    this.askConfig = askConfig || {};
    this.relationships = relationships;
    this.getDefaultTimeField = getDefaultTimeField;
  }

  timeSqlExpression(field, alias) {
    const isNativeDate = /date|timestamp|time/i.test(field.type || '');
    if (isNativeDate) return `${alias}.${quoteIdent(field.column)}`;
    return field.parseFormat
      ? `STRPTIME(CAST(${alias}.${quoteIdent(field.column)} AS VARCHAR), '${field.parseFormat}')`
      : `TRY_CAST(${alias}.${quoteIdent(field.column)} AS DATE)`;
  }

  plan(intent): PlannedSql {
    const fields = [
      intent.metric?.field || intent.metric,
      intent.timeField,
      ...intent.dimensions,
      ...intent.filters.map((f) => f.field),
      intent.dateRange?.field,
    ].filter((f) => f && f.table);
    const baseTable =
      intent.metric?.field?.table ||
      intent.metric?.table ||
      fields[0]?.table ||
      this.config.dataSources?.[0]?.name;
    const neededTables = [...new Set([baseTable, ...fields.map((f) => f.table)])];
    const joinPlan = this.buildJoinPlan(baseTable, neededTables) as {
      error?: string;
      tables: string[];
      joins: Relationship[];
    };
    if (joinPlan.error) return { error: joinPlan.error };

    const aliases = new Map(joinPlan.tables.map((table, i) => [table, safeAlias(table, i)]));
    const selectParts: string[] = [];
    const groupParts: string[] = [];
    for (const dim of intent.dimensions) {
      const alias = aliases.get(dim.table);
      let expr;
      if (dim.role === 'time') {
        expr = `DATE_TRUNC('${intent.timeGrain || 'month'}', ${this.timeSqlExpression(dim, alias)})`;
      } else {
        expr = `${alias}.${quoteIdent(dim.column)}`;
      }
      const dimAlias = `d${selectParts.length + 1}`;
      selectParts.push(`${expr} AS ${quoteIdent(dimAlias)}`);
      groupParts.push(expr);
    }

    const { metricExpr, metricFormat } = this.buildMetricExpr(intent, aliases);
    const whereParts = this.buildWhereParts(intent, aliases);
    const from = `${quoteIdent(baseTable)} ${aliases.get(baseTable)}`;
    const joins = joinPlan.joins.map((rel) => {
      const leftAlias = aliases.get(rel.left.table);
      const rightAlias = aliases.get(rel.right.table);
      const joinTable = rel.right.table;
      return `JOIN ${quoteIdent(joinTable)} ${rightAlias} ON ${leftAlias}.${quoteIdent(rel.left.column)} = ${rightAlias}.${quoteIdent(rel.right.column)}`;
    });

    const diagnostics = this.buildDiagnostics({
      intent,
      baseTable,
      aliases,
      from,
      joinSqls: joins,
      joinRels: joinPlan.joins,
      whereParts,
    });

    if (intent.analysisType === 'list_values')
      return this.planListValues(intent, aliases, whereParts, from, joins, diagnostics);
    if (intent.analysisType === 'yoy')
      return this.planYoY(intent, aliases, metricExpr, whereParts, from, joins, diagnostics);
    if (intent.analysisType === 'change')
      return this.planChange(
        intent,
        aliases,
        metricExpr,
        metricFormat,
        whereParts,
        from,
        joins,
        diagnostics,
      );
    if (intent.analysisType === 'share')
      return this.planShare(
        intent,
        selectParts,
        groupParts,
        metricExpr,
        metricFormat,
        whereParts,
        from,
        joins,
        diagnostics,
      );
    return this.planGrouped(
      intent,
      selectParts,
      groupParts,
      metricExpr,
      metricFormat,
      whereParts,
      from,
      joins,
      diagnostics,
    );
  }

  buildMetricExpr(intent, aliases) {
    let metricExpr: string | null = null;
    let metricFormat: string | undefined;
    if (intent.metric?.kind === 'count_star') {
      metricExpr = 'COUNT(*)';
    } else if (intent.metric?.kind === 'count_distinct') {
      const f = intent.metric.field;
      metricExpr = `COUNT(DISTINCT ${aliases.get(f.table)}.${quoteIdent(f.column)})`;
    } else if (intent.analysisType !== 'list_values' && intent.metric) {
      const m = intent.metric;
      metricFormat = m.format;
      metricExpr = `${m.aggregation || 'SUM'}(${aliases.get(m.table)}.${quoteIdent(m.column)})`;
    }
    return { metricExpr, metricFormat };
  }

  buildWhereConditions(intent, aliases): WhereCondition[] {
    const conditions: WhereCondition[] = intent.filters.map((filter) => {
      const tableAlias = aliases.get(filter.field.table);
      const column = filter.field.column;
      if (filter.operator === 'IN') {
        return { kind: 'in', tableAlias, column, values: filter.values || [] };
      }
      return { kind: 'eq', tableAlias, column, value: filter.value };
    });
    if (intent.dateRange?.field) {
      const field = intent.dateRange.field;
      const dateExpr = this.timeSqlExpression(field, aliases.get(field.table));
      if (intent.dateRange.kind === 'monthOfYear') {
        conditions.push({ kind: 'month_of_year', dateExpr, month: intent.dateRange.month });
      } else {
        conditions.push({
          kind: 'date_range',
          dateExpr,
          start: intent.dateRange.start,
          end: intent.dateRange.end,
        });
      }
    }
    return conditions;
  }

  buildWhereParts(intent, aliases): string[] {
    return new SqlRenderer().renderConditions(this.buildWhereConditions(intent, aliases));
  }

  planListValues(intent, aliases, whereParts, from, joins, diagnostics) {
    const dim = intent.dimensions[0];
    const expr = `${aliases.get(dim.table)}.${quoteIdent(dim.column)}`;
    const listWhereParts = [...whereParts, `${expr} IS NOT NULL`, `CAST(${expr} AS VARCHAR) <> ''`];
    const sql = `SELECT DISTINCT ${expr} AS label\nFROM ${from}\n${joins.join('\n')}\nWHERE ${listWhereParts.join(' AND ')}\nORDER BY label ASC\nLIMIT ${Number(intent.limit) || this.askConfig.maxRows || 25}`;
    return { sql, columns: ['label'], diagnostics };
  }

  planYoY(intent, aliases, metricExpr, whereParts, from, joins, diagnostics) {
    const timeField =
      intent.timeField ||
      intent.dimensions.find((d) => d.role === 'time') ||
      this.getDefaultTimeField();
    if (!timeField)
      return { error: 'I could not find a date/time field for year-over-year analysis.' };
    const periodExpr = `DATE_TRUNC('year', ${this.timeSqlExpression(timeField, aliases.get(timeField.table))})`;
    const yoyJoins = joins.length ? `\n  ${joins.join('\n  ')}` : '';
    const yoyWhere = whereParts.length ? `\n  WHERE ${whereParts.join(' AND ')}` : '';
    const sql = `WITH yearly AS (\n  SELECT ${periodExpr} AS period, ${metricExpr} AS value\n  FROM ${from}${yoyJoins}${yoyWhere}\n  GROUP BY 1\n), yoy AS (\n  SELECT period, value, LAG(value) OVER (ORDER BY period) AS previous_value\n  FROM yearly\n)\nSELECT CAST(period AS VARCHAR) AS period, value, previous_value, value - previous_value AS change, CASE WHEN previous_value IS NULL OR previous_value = 0 THEN NULL ELSE (value - previous_value) / previous_value END AS change_percent\nFROM yoy\nORDER BY period ASC`;
    return {
      sql,
      columns: ['period', 'value', 'previous_value', 'change', 'change_percent'],
      diagnostics,
    };
  }

  planChange(intent, aliases, metricExpr, metricFormat, whereParts, from, joins, diagnostics) {
    const timeField = intent.timeField || this.getDefaultTimeField();
    if (!timeField) return { error: 'I could not find a date/time field for change analysis.' };
    const dateExpr = this.timeSqlExpression(timeField, aliases.get(timeField.table));
    const startYear = Number(intent.change.startYear);
    const endYear = Number(intent.change.endYear);
    const changeWhere = [
      ...whereParts,
      `EXTRACT(year FROM ${dateExpr}) IN (${startYear}, ${endYear})`,
    ];
    const changeJoins = joins.length ? `\n  ${joins.join('\n  ')}` : '';
    const changeWhereClause = changeWhere.length ? `\n  WHERE ${changeWhere.join(' AND ')}` : '';
    const sql = `WITH yearly AS (\n  SELECT EXTRACT(year FROM ${dateExpr}) AS year, ${metricExpr} AS value\n  FROM ${from}${changeJoins}${changeWhereClause}\n  GROUP BY 1\n), picked AS (\n  SELECT SUM(CASE WHEN year = ${startYear} THEN value END) AS start_value, SUM(CASE WHEN year = ${endYear} THEN value END) AS end_value\n  FROM yearly\n)\nSELECT '${startYear} to ${endYear}' AS period, start_value, end_value, end_value - start_value AS change, CASE WHEN start_value IS NULL OR start_value = 0 THEN NULL ELSE (end_value - start_value) / start_value END AS change_percent\nFROM picked`;
    return {
      sql,
      columns: ['period', 'start_value', 'end_value', 'change', 'change_percent'],
      diagnostics,
      metricFormat,
    };
  }

  planShare(
    intent,
    selectParts,
    groupParts,
    metricExpr,
    metricFormat,
    whereParts,
    from,
    joins,
    diagnostics,
  ) {
    if (!intent.dimensions.length)
      return { error: 'I need a dimension to calculate share of total.' };
    const shareInnerSelect = [...selectParts, `${metricExpr} AS value`].join(',\n  ');
    const shareJoinsClause = joins.length ? `\n${joins.join('\n')}` : '';
    const shareWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
    const shareInner = `SELECT\n  ${shareInnerSelect}\nFROM ${from}${shareJoinsClause}${shareWhereClause}\nGROUP BY ${groupParts.map((_, i) => i + 1).join(', ')}`;
    const shareLabelExpr =
      intent.dimensions.length === 1
        ? `CAST(d1 AS VARCHAR)`
        : intent.dimensions.map((_, i) => `CAST(d${i + 1} AS VARCHAR)`).join(` || ' / ' || `);
    const escapedShareValues = (intent.shareValues || []).length
      ? new SqlRenderer().renderEscapedList(intent.shareValues || [])
      : '';
    const shareFilterClause = escapedShareValues ? `\nWHERE label IN (${escapedShareValues})` : '';
    const sql = `WITH grouped AS (\n${shareInner}\n), shares AS (\n  SELECT ${shareLabelExpr} AS label, value, CASE WHEN SUM(value) OVER () = 0 THEN NULL ELSE value / SUM(value) OVER () END AS share\n  FROM grouped\n)\nSELECT label, value, share\nFROM shares${shareFilterClause}\nORDER BY value ${intent.sort?.direction || 'DESC'}\nLIMIT ${Number(intent.limit) || this.askConfig.maxRows || 25}`;
    return { sql, columns: ['label', 'value', 'share'], metricFormat, diagnostics };
  }

  planGrouped(
    intent,
    selectParts,
    groupParts,
    metricExpr,
    metricFormat,
    whereParts,
    from,
    joins,
    diagnostics,
  ) {
    let sql: string;
    if (intent.dimensions.length) {
      const groupedInnerSelect = [...selectParts, `${metricExpr} AS value`].join(',\n  ');
      const groupedJoinsClause = joins.length ? `\n${joins.join('\n')}` : '';
      const groupedWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      const groupedInner = `SELECT\n  ${groupedInnerSelect}\nFROM ${from}${groupedJoinsClause}${groupedWhereClause}\nGROUP BY ${groupParts.map((_, i) => i + 1).join(', ')}`;
      const groupedLabelExpr =
        intent.dimensions.length === 1
          ? `CAST(d1 AS VARCHAR)`
          : intent.dimensions.map((_, i) => `CAST(d${i + 1} AS VARCHAR}`).join(` || ' / ' || `);
      const orderBy =
        intent.dimensions[0]?.role === 'time'
          ? 'label ASC'
          : `value ${intent.sort?.direction || 'DESC'}`;
      sql = `SELECT ${groupedLabelExpr} AS label, value\nFROM (\n${groupedInner}\n) q\nORDER BY ${orderBy}\nLIMIT ${Number(intent.limit) || this.askConfig.maxRows || 25}`;
    } else {
      const simpleJoinsClause = joins.length ? `\n${joins.join('\n')}` : '';
      const simpleWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      sql = `SELECT ${metricExpr} AS value\nFROM ${from}${simpleJoinsClause}${simpleWhereClause}`;
    }
    return {
      sql,
      columns: intent.dimensions.length ? ['label', 'value'] : ['value'],
      metricFormat,
      diagnostics,
    };
  }

  buildDiagnostics({ intent, baseTable, aliases, from, joinSqls, joinRels, whereParts }) {
    const joinsSuffix = joinSqls.length ? `\n${joinSqls.join('\n')}` : '';
    const joinedFrom = `${from}${joinsSuffix}`;
    const diagnostics: Diagnostics = {};
    if (joinSqls.length) {
      const baseAlias = aliases.get(baseTable);
      const baseWhereParts = whereParts.filter((part) => part.includes(`${baseAlias}.`));
      const baseWhereClause = baseWhereParts.length
        ? `\nWHERE ${baseWhereParts.join(' AND ')}`
        : '';
      const joinedWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      const baseSql = `SELECT COUNT(*) AS row_count FROM ${from}${baseWhereClause}`;
      const joinedSql = `SELECT COUNT(*) AS row_count FROM ${joinedFrom}${joinedWhereClause}`;
      diagnostics.joinFanout = {
        baseTable,
        joinedTables: [...new Set(joinRels.map((rel) => rel.right.table))] as string[],
        baseCountSql: baseSql,
        joinedCountSql: joinedSql,
        threshold: this.askConfig.validation?.joinFanoutRatio || 1.5,
        minExtraRows: this.askConfig.validation?.joinFanoutMinExtraRows || 100,
      };
    }
    if (whereParts.length) {
      diagnostics.filterSelectivity = {
        unfilteredCountSql: `SELECT COUNT(*) AS row_count FROM ${joinedFrom}`,
        filteredCountSql: `SELECT COUNT(*) AS row_count FROM ${joinedFrom}\nWHERE ${whereParts.join(' AND ')}`,
        threshold: this.askConfig.validation?.filterSelectivityRatio || 0.1,
      };
    }
    const timeField =
      intent.timeField ||
      intent.dimensions?.find((field) => field.role === 'time') ||
      intent.dateRange?.field;
    if (timeField) {
      const alias = aliases.get(timeField.table);
      const rawExpr = `${alias}.${quoteIdent(timeField.column)}`;
      const isNativeDate = /date|timestamp|time/i.test(timeField.type || '');
      const tryExpr =
        !isNativeDate && timeField.parseFormat
          ? `TRY_STRPTIME(CAST(${rawExpr} AS VARCHAR), '${timeField.parseFormat}')`
          : `TRY_CAST(${rawExpr} AS DATE)`;
      const dateParseWhereClause = whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '';
      diagnostics.dateParse = {
        field: timeField.label || timeField.column,
        sql: `SELECT COUNT(*) AS checked_rows, SUM(CASE WHEN ${rawExpr} IS NOT NULL AND ${tryExpr} IS NULL THEN 1 ELSE 0 END) AS dropped_rows FROM ${joinedFrom}${dateParseWhereClause}`,
      };
    }
    return Object.keys(diagnostics).length ? diagnostics : null;
  }

  buildJoinPlan(baseTable, neededTables) {
    const tables: string[] = [baseTable];
    const joins: Relationship[] = [];
    for (const table of neededTables) {
      if (tables.includes(table)) continue;
      const path = this.findRelationshipPath(tables, table);
      if (!path)
        return {
          error: `I do not know how to join ${baseTable} to ${table}. Add a relationship or confirm an inferred join.`,
        };
      for (const rel of path) {
        const leftKnown = tables.includes(rel.left.table);
        const rightKnown = tables.includes(rel.right.table);
        if (leftKnown && !rightKnown) {
          joins.push(rel);
          tables.push(rel.right.table);
        } else if (rightKnown && !leftKnown) {
          joins.push({
            left: rel.right,
            right: rel.left,
            confidence: rel.confidence,
            inferred: rel.inferred,
          });
          tables.push(rel.left.table);
        }
      }
    }
    return { tables, joins };
  }

  findRelationshipPath(startTables: string[], targetTable: string) {
    const queue: { table: string; path: Relationship[] }[] = startTables.map((table) => ({
      table,
      path: [],
    }));
    const visited = new Set(startTables);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.table === targetTable) return current.path;
      for (const rel of this.relationships()) {
        let next: string | null = null;
        if (rel.left.table === current.table) next = rel.right.table;
        else if (rel.right.table === current.table) next = rel.left.table;
        if (!next || visited.has(next)) continue;
        visited.add(next);
        queue.push({ table: next, path: [...current.path, rel] });
      }
    }
    return null;
  }
}
