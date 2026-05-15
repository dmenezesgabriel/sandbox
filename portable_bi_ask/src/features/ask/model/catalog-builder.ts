import type { QueryPort } from '../../../infra/query/query-port';
import type {
  CatalogField,
  Entity,
  EntityConfig,
  FieldConfig,
  Relationship,
} from '../../../shared/types/index';
import {
  addMonths,
  asIsoDate,
  compact,
  detectDateFormat,
  fieldKey,
  isIdLike,
  isoDate,
  norm,
  numberValue,
  quoteIdent,
  startOfMonth,
  startOfYear,
  toRows,
} from '../../../shared/utils/utils';
import { AutoFieldRoleDetector, type FieldSignature } from './semantic-modeling';

export class CatalogBuilder {
  private readonly roleDetector = new AutoFieldRoleDetector();
  config: { dataSources?: Array<{ name: string }>; relationships?: Relationship[] };
  askConfig: {
    fields?: FieldConfig[];
    entities?: EntityConfig[];
    relationships?: Relationship[];
    inferRelationships?: boolean;
    profiling?: { maxDistinctValuesPerField?: number; maxSampleRows?: number };
    relationshipInference?: { autoAcceptThreshold?: number; ambiguousThreshold?: number };
  };
  duckDBManager: QueryPort;
  fieldByKey: Map<string, CatalogField>;
  displayLabel: (item: CatalogField | EntityConfig) => string;
  localizedTerms: (item: CatalogField | EntityConfig) => string[];
  timeSqlExpression: (field: CatalogField, alias: string) => string;

  constructor({
    config,
    askConfig,
    duckDBManager,
    fieldByKey,
    displayLabel,
    localizedTerms,
    timeSqlExpression,
  }: {
    config: CatalogBuilder['config'];
    askConfig?: CatalogBuilder['askConfig'];
    duckDBManager: QueryPort;
    fieldByKey: Map<string, CatalogField>;
    displayLabel: CatalogBuilder['displayLabel'];
    localizedTerms: CatalogBuilder['localizedTerms'];
    timeSqlExpression: CatalogBuilder['timeSqlExpression'];
  }) {
    this.config = config;
    this.askConfig = askConfig || {};
    this.duckDBManager = duckDBManager;
    this.fieldByKey = fieldByKey;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.timeSqlExpression = timeSqlExpression;
  }

  async build() {
    this.fieldByKey.clear();
    const overrides = new Map(
      (this.askConfig.fields || []).map((f) => [fieldKey(f.table, f.column), f]),
    );
    const tableProfiles = new Map<string, { rowCount: number }>();
    const fields: CatalogField[] = [];

    for (const source of this.config.dataSources || []) {
      const table = source.name;
      const countRows = toRows(
        await this.duckDBManager.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdent(table)}`),
      );
      const rowCount = numberValue(
        countRows[0]?.row_count ?? countRows[0]?.rowCount ?? countRows[0]?.count_star ?? 0,
      );
      tableProfiles.set(table, { rowCount });

      const schemaRows = toRows(
        await this.duckDBManager.query(`DESCRIBE SELECT * FROM ${quoteIdent(table)}`),
      );
      for (const col of schemaRows) {
        const field = await this.buildField({ table, rowCount, col, overrides });
        if (!field) continue;
        fields.push(field);
        this.fieldByKey.set(field.id, field);
      }
    }

    const { relationships, ambiguousRelationships } = this.inferRelationships(
      fields,
      tableProfiles,
    );
    const entities = this.buildEntities(fields);
    return { catalog: fields, relationships, ambiguousRelationships, entities };
  }

  async buildField({ table, rowCount, col, overrides }) {
    const column = col.column_name || col.columnName || col.name;
    const type = col.column_type || col.columnType || col.type || '';
    if (!column) return null;
    const override = overrides.get(fieldKey(table, column)) || {};
    const sampleRows = toRows(
      await this.duckDBManager.query(
        `SELECT ${quoteIdent(column)} AS v FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} IS NOT NULL LIMIT ${this.askConfig.profiling?.maxSampleRows || 1000}`,
      ),
    );
    const samples = sampleRows.map((r) => r.v).filter((v) => v !== null && v !== undefined);
    const distinctRows = toRows(
      await this.duckDBManager.query(
        `SELECT COUNT(DISTINCT ${quoteIdent(column)}) AS distinct_count FROM ${quoteIdent(table)}`,
      ),
    );
    const cardinality = numberValue(distinctRows[0]?.distinct_count ?? 0);
    const signature: FieldSignature = { table, column, type, samples, cardinality, rowCount };
    const role = override.role ?? this.roleDetector.detectRole(signature).role;
    const parseFormat =
      override.parseFormat || (role === 'time' ? detectDateFormat(samples) : null);
    const lowEnoughCardinality =
      cardinality <= (this.askConfig.profiling?.maxDistinctValuesPerField || 100);
    const sampleValues =
      role === 'dimension' && lowEnoughCardinality
        ? [...new Set(samples.map(String))]
            .sort()
            .slice(0, this.askConfig.profiling?.maxDistinctValuesPerField || 100)
        : [];
    const field: CatalogField = {
      id: fieldKey(table, column),
      table,
      column,
      type,
      role,
      label: override.label || column,
      labels: override.labels || {},
      aggregation: override.aggregation || (role === 'measure' ? 'SUM' : undefined),
      synonyms: override.synonyms || [],
      localizedSynonyms: override.localizedSynonyms || {},
      description: override.description || '',
      format: override.format,
      default: !!override.default,
      priority: override.priority || 0,
      parseFormat,
      sampleValues,
      samples: samples.slice(0, 100),
      dateProfile: null,
      cardinality,
      rowCount,
    };
    if (field.role === 'time') field.dateProfile = await this.profileTimeField(field);
    return field;
  }

  async profileTimeField(field) {
    try {
      const expr = this.timeSqlExpression(field, quoteIdent(field.table));
      const sql = `SELECT MIN(CAST(${expr} AS DATE)) AS min_date, MAX(CAST(${expr} AS DATE)) AS max_date FROM ${quoteIdent(field.table)} WHERE ${expr} IS NOT NULL`;
      const row = toRows(await this.duckDBManager.query(sql))[0] || {};
      const minDate = asIsoDate(row.min_date);
      const maxDate = asIsoDate(row.max_date);
      if (!minDate || !maxDate) return null;
      const max = new Date(`${maxDate}T00:00:00Z`);
      const latestMonthStart = startOfMonth(max);
      const latestYearStart = startOfYear(max);
      return {
        minDate,
        maxDate,
        latestMonthStart: isoDate(latestMonthStart),
        latestMonthEnd: isoDate(addMonths(latestMonthStart, 1)),
        latestYearStart: isoDate(latestYearStart),
        latestYearEnd: isoDate(new Date(Date.UTC(latestYearStart.getUTCFullYear() + 1, 0, 1))),
      };
    } catch (err) {
      console.warn('[AskData] Failed to profile time field', field.id, err);
      return null;
    }
  }

  scoreAndClassifyRelationships(byColumn) {
    const accepted: Relationship[] = [];
    const ambiguous: Relationship[] = [];
    for (const matches of byColumn.values()) {
      for (let i = 0; i < matches.length; i++) {
        for (let j = i + 1; j < matches.length; j++) {
          const rel = this.scoreRelationship(matches[i], matches[j]);
          if (!rel) continue;
          if (rel.confidence >= (this.askConfig.relationshipInference?.autoAcceptThreshold || 0.85))
            accepted.push(rel);
          else if (
            rel.confidence >= (this.askConfig.relationshipInference?.ambiguousThreshold || 0.6)
          )
            ambiguous.push(rel);
        }
      }
    }
    return { accepted, ambiguous };
  }

  inferRelationships(fields, _tableProfiles) {
    const explicit = this.config.relationships || this.askConfig.relationships || [];
    if (explicit.length)
      return {
        relationships: explicit.map((r) => ({ ...r, confidence: 1, inferred: false })),
        ambiguousRelationships: [],
      };
    if (this.askConfig.inferRelationships === false)
      return { relationships: [], ambiguousRelationships: [] };

    const byColumn = new Map<string, CatalogField[]>();
    for (const f of fields.filter((f) => f.role === 'key' || isIdLike(f.column))) {
      const key = compact(f.column);
      if (!byColumn.has(key)) byColumn.set(key, []);
      byColumn.get(key)!.push(f);
    }

    const { accepted, ambiguous } = this.scoreAndClassifyRelationships(byColumn);
    return { relationships: accepted, ambiguousRelationships: ambiguous };
  }

  scoreRelationship(a, b) {
    if (a.table === b.table) return null;
    const overlap = this.sampleOverlap(a.samples, b.samples);
    const aUnique = a.cardinality / Math.max(1, a.rowCount);
    const bUnique = b.cardinality / Math.max(1, b.rowCount);
    const oneSideLookup = (aUnique > 0.75 && bUnique < 0.95) || (bUnique > 0.75 && aUnique < 0.95);
    let score = 0.45;
    if (/id$/i.test(norm(a.column).replaceAll(' ', ''))) score += 0.25;
    if (overlap > 0.2) score += 0.2;
    if (oneSideLookup) score += 0.1;
    return {
      left: { table: a.table, column: a.column },
      right: { table: b.table, column: b.column },
      confidence: Number(score.toFixed(2)),
      inferred: true,
      overlap: Number(overlap.toFixed(2)),
    };
  }

  sampleOverlap(aValues, bValues) {
    const a = new Set(aValues.map(String));
    const b = new Set(bValues.map(String));
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    for (const v of a) if (b.has(v)) overlap++;
    return overlap / Math.min(a.size, b.size);
  }

  buildEntities(fields: CatalogField[]): Entity[] {
    const configured = this.askConfig.entities || [];
    const entities: Entity[] = configured
      .map((e) => ({
        ...e,
        field: this.fieldByKey.get(fieldKey(e.table, e.key)),
        terms: [
          e.label,
          this.displayLabel(e),
          e.singular,
          ...(e.synonyms || []),
          ...this.localizedTerms(e),
        ]
          .filter(Boolean)
          .map(norm),
      }))
      .filter((e): e is Entity => !!e.field);

    for (const field of fields.filter((f) => f.role === 'key' && / id$/i.test(f.column))) {
      const base = field.column.replace(/ ID$/i, '').replace(/ID$/i, '');
      if (!entities.some((e) => e.table === field.table && e.key === field.column)) {
        entities.push({
          label: `${base}s`,
          singular: base,
          table: field.table,
          key: field.column,
          field,
          terms: [norm(base), norm(`${base}s`)],
        });
      }
    }
    for (const entity of entities) {
      const configuredDims = (entity.preferredDimensions || [])
        .map((column) => this.fieldByKey.get(fieldKey(entity.table, column)))
        .filter((f): f is CatalogField => !!f);
      const inferred = fields
        .filter((f) => f.table === entity.table && f.role === 'dimension')
        .sort((a, b) => a.cardinality - b.cardinality || (b.priority || 0) - (a.priority || 0));
      entity.preferredDimensionFields = configuredDims.length ? configuredDims : inferred;
    }
    return entities;
  }
}
