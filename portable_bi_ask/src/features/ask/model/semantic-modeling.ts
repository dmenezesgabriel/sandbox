import type { CatalogField, FieldRole, Relationship } from '../../../shared/types/index';
import { norm } from '../../../shared/utils/utils';

export interface FieldSignature {
  table: string;
  column: string;
  type: string;
  samples: unknown[];
  cardinality: number;
  rowCount: number;
}

export interface AutoFieldConfig {
  table: string;
  column: string;
  role?: FieldRole;
  aggregation?: string;
  label?: string;
  synonyms?: string[];
  description?: string;
  format?: string;
  priority?: number;
}

export interface AutoRelationship {
  left: { table: string; column: string };
  right: { table: string; column: string };
  confidence: number;
  overlap: number;
  reasoning: string;
}

export interface SemanticModelingResult {
  autoFields: Map<string, AutoFieldConfig>;
  autoRelationships: AutoRelationship[];
  ambiguousRelationships: AutoRelationship[];
}

const DATE_PATTERNS = [
  /date/i,
  /time/i,
  /timestamp/i,
  /dt$/i,
  /_dt$/i,
  /_at$/i,
  /_date/i,
  /ano/i,
  /mes/i,
  /dia/i,
  /hora/i,
  /data/i,
];

const ID_PATTERNS = [
  /_?id$/i,
  /_?key$/i,
  /_?code$/i,
  /^id_/i,
  /^pk_/i,
  /^fk_/i,
  /_?codigo/i,
  /_?cod/i,
];

const MEASURE_PATTERNS = [
  /amount/i,
  /total/i,
  /sum/i,
  /count/i,
  /qty/i,
  /quantity/i,
  /price/i,
  /cost/i,
  /revenue/i,
  /profit/i,
  /sales/i,
  /value/i,
  /volume/i,
  /valor/i,
  /quantidade/i,
  /preco/i,
  /custo/i,
  /venda/i,
];

const DIMENSION_PATTERNS = [
  /name/i,
  /type/i,
  /category/i,
  /status/i,
  /region/i,
  /city/i,
  /state/i,
  /country/i,
  /segment/i,
  /class/i,
  /zone/i,
  /nome/i,
  /tipo/i,
  /categoria/i,
  /estado/i,
  /cidade/i,
];

export class AutoFieldRoleDetector {
  private readonly idPatterns: RegExp[];
  private readonly datePatterns: RegExp[];
  private readonly measurePatterns: RegExp[];
  private readonly dimensionPatterns: RegExp[];

  constructor() {
    this.idPatterns = ID_PATTERNS.map((p) => p);
    this.datePatterns = DATE_PATTERNS.map((p) => p);
    this.measurePatterns = MEASURE_PATTERNS.map((p) => p);
    this.dimensionPatterns = DIMENSION_PATTERNS.map((p) => p);
  }

  detectRole(signature: FieldSignature): {
    role: FieldRole;
    confidence: number;
    reasoning: string;
  } {
    const normalizedColumn = norm(signature.column);

    if (this.matchesPatterns(normalizedColumn, this.idPatterns)) {
      return { role: 'key', confidence: 0.95, reasoning: 'Column name matches ID/key pattern' };
    }

    if (this.matchesDatePatterns(signature)) {
      return {
        role: 'time',
        confidence: 0.9,
        reasoning: 'Column name or samples match date patterns',
      };
    }

    if (signature.type && /^(?:int|bigint|float|double|decimal)/i.test(signature.type)) {
      return this.detectNumericRole(signature, normalizedColumn);
    }

    if (signature.type && /^(?:varchar|text|string|char)/i.test(signature.type)) {
      return this.detectStringRole(signature, normalizedColumn);
    }

    return { role: 'dimension', confidence: 0.6, reasoning: 'Default role for unknown types' };
  }

  private isNumericType(type: string): boolean {
    return /^(?:int|bigint|float|double|decimal)/i.test(type);
  }

  private detectNumericRole(
    signature: FieldSignature,
    normalizedColumn: string,
  ): { role: FieldRole; confidence: number; reasoning: string } {
    const cardinalityRatio = signature.cardinality / Math.max(1, signature.rowCount);

    if (cardinalityRatio < 0.01 && signature.cardinality <= 10) {
      return { role: 'dimension', confidence: 0.85, reasoning: 'Low cardinality numeric field' };
    }

    if (this.matchesPatterns(normalizedColumn, this.measurePatterns)) {
      return {
        role: 'measure',
        confidence: 0.88,
        reasoning: 'Numeric field with measure-like name',
      };
    }

    if (cardinalityRatio > 0.5 || signature.cardinality > signature.rowCount * 0.1) {
      return {
        role: 'measure',
        confidence: 0.8,
        reasoning: 'High cardinality numeric suggests continuous measure',
      };
    }

    return { role: 'measure', confidence: 0.75, reasoning: 'Default for numeric fields' };
  }

  private detectStringRole(
    signature: FieldSignature,
    normalizedColumn: string,
  ): { role: FieldRole; confidence: number; reasoning: string } {
    const cardinalityRatio = signature.cardinality / Math.max(1, signature.rowCount);

    if (cardinalityRatio < 0.05 || signature.cardinality <= 50) {
      if (this.matchesPatterns(normalizedColumn, this.dimensionPatterns)) {
        return {
          role: 'dimension',
          confidence: 0.9,
          reasoning: 'Low cardinality string field with dimension-like name',
        };
      }
      return { role: 'dimension', confidence: 0.85, reasoning: 'Low cardinality string field' };
    }

    return {
      role: 'dimension',
      confidence: 0.7,
      reasoning: 'High cardinality string field treated as dimension',
    };
  }

  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(text));
  }

  private matchesDatePatterns(signature: FieldSignature): boolean {
    if (this.matchesPatterns(signature.column, this.datePatterns)) {
      return true;
    }

    if (signature.samples.length > 0) {
      const dateLikeSamples = signature.samples.filter((s) => this.isDateLike(s)).length;
      return dateLikeSamples / signature.samples.length > 0.8;
    }

    return false;
  }

  private isDateLike(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{2}-\d{2}-\d{4}/,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}/,
    ];
    return datePatterns.some((p) => p.test(value));
  }

  generateSynonyms(field: CatalogField): string[] {
    const synonyms: string[] = [];
    const normalizedLabel = norm(field.label);
    const normalizedColumn = norm(field.column);

    if (field.role === 'measure') {
      synonyms.push(...this.measureSynonyms(normalizedLabel, normalizedColumn));
    } else if (field.role === 'dimension') {
      synonyms.push(...this.dimensionSynonyms(normalizedLabel, normalizedColumn, field.table));
    } else if (field.role === 'time') {
      synonyms.push(...this.timeSynonyms(normalizedLabel, normalizedColumn));
    }

    return [...new Set(synonyms)];
  }

  private measureSynonyms(label: string, _column: string): string[] {
    const synonyms: string[] = [];

    if (/sales|revenue|amount|value/i.test(label)) {
      synonyms.push('income', 'total', 'turnover', 'monetary value');
    }
    if (/quantity|qty|count/i.test(label)) {
      synonyms.push('number of', 'units', 'items');
    }
    if (/profit|margin/i.test(label)) {
      synonyms.push('earnings', 'gain', 'net');
    }
    if (/cost|price/i.test(label)) {
      synonyms.push('expense', 'spending');
    }

    return synonyms;
  }

  private dimensionSynonyms(label: string, _column: string, _table: string): string[] {
    const synonyms: string[] = [];

    if (/region|territory|area|zone/i.test(label)) {
      synonyms.push('location', 'market', 'geographic');
    }
    if (/category|class|group/i.test(label)) {
      synonyms.push('segment', 'type', 'classification');
    }
    if (/segment|market/i.test(label)) {
      synonyms.push('group', 'cluster', 'audience');
    }
    if (/state|city|location/i.test(label)) {
      synonyms.push('place', 'geography');
    }
    if (/product|item/i.test(label)) {
      synonyms.push('goods', 'merchandise');
    }
    if (/customer|client/i.test(label)) {
      synonyms.push('buyer', 'consumer', 'user');
    }
    if (/name|title/i.test(label)) {
      synonyms.push('description', 'label');
    }

    return synonyms;
  }

  private timeSynonyms(label: string, _column: string): string[] {
    const synonyms: string[] = [];

    if (/order|ship|delivery|purchase/i.test(label)) {
      synonyms.push('transaction date', 'event date');
    }
    if (/date|time/i.test(label)) {
      synonyms.push('period', 'timestamp');
    }

    return synonyms;
  }

  generateDescription(field: CatalogField): string {
    const roleDescriptions: Record<FieldRole, string> = {
      measure: 'Numeric metric for aggregation queries.',
      dimension: 'Categorical breakdown for grouping and filtering.',
      time: 'Temporal field for time-based analysis.',
      key: 'Unique identifier for entity lookup.',
    };

    let desc = roleDescriptions[field.role] || '';

    if (field.role === 'measure') {
      desc += ` Aggregated using ${field.aggregation || 'SUM'}.`;
    }

    if (field.role === 'time' && field.dateProfile) {
      const minDate = field.dateProfile.minDate;
      const maxDate = field.dateProfile.maxDate;
      desc += ` Covers ${minDate} to ${maxDate}.`;
    }

    if (field.cardinality > 0) {
      const uniqueness = field.cardinality / Math.max(1, field.rowCount);
      if (uniqueness > 0.9) {
        desc += ' High cardinality.';
      } else if (uniqueness < 0.1) {
        desc += ` ${field.cardinality} distinct values.`;
      }
    }

    return desc.trim();
  }

  suggestAggregation(field: CatalogField): string {
    if (field.role !== 'measure') return undefined as unknown as string;

    const columnLower = norm(field.column);

    if (/count|num|qty|quantity|orders|items/i.test(columnLower)) {
      return 'COUNT';
    }
    if (/avg|average|mean/i.test(columnLower)) {
      return 'AVG';
    }
    if (/min/i.test(columnLower)) {
      return 'MIN';
    }
    if (/max/i.test(columnLower)) {
      return 'MAX';
    }

    return 'SUM';
  }
}

export class AutoRelationshipInferrer {
  private readonly config: {
    autoAcceptThreshold: number;
    ambiguousThreshold: number;
    minOverlap: number;
    maxCardinalityRatio: number;
  };

  constructor(config?: Partial<AutoRelationshipInferrer['config']>) {
    this.config = {
      autoAcceptThreshold: config?.autoAcceptThreshold ?? 0.75,
      ambiguousThreshold: config?.ambiguousThreshold ?? 0.5,
      minOverlap: config?.minOverlap ?? 0.15,
      maxCardinalityRatio: config?.maxCardinalityRatio ?? 0.05,
    };
  }

  inferRelationships(fields: CatalogField[]): {
    relationships: AutoRelationship[];
    ambiguous: AutoRelationship[];
  } {
    const keyFields = fields.filter((f) => f.role === 'key' || this.looksLikeKey(f));
    const candidatePairs = this.findCandidatePairs(keyFields);

    const scored = candidatePairs
      .map((pair) => this.scoreRelationship(pair))
      .filter((r) => r.confidence >= this.config.ambiguousThreshold);

    const relationships = scored.filter((r) => r.confidence >= this.config.autoAcceptThreshold);
    const ambiguous = scored.filter(
      (r) =>
        r.confidence >= this.config.ambiguousThreshold &&
        r.confidence < this.config.autoAcceptThreshold,
    );

    return { relationships, ambiguous };
  }

  private looksLikeKey(field: CatalogField): boolean {
    return /_?id$/i.test(field.column) || /_?key$/i.test(field.column);
  }

  private findCandidatePairs(keyFields: CatalogField[]): Array<[CatalogField, CatalogField]> {
    const pairs: Array<[CatalogField, CatalogField]> = [];

    for (let i = 0; i < keyFields.length; i++) {
      for (let j = i + 1; j < keyFields.length; j++) {
        const a = keyFields[i];
        const b = keyFields[j];

        if (a.table === b.table) continue;

        if (this.columnNamesMatch(a.column, b.column)) {
          pairs.push([a, b]);
        }

        const baseNameA = this.extractBaseName(a.column);
        const baseNameB = this.extractBaseName(b.column);
        if (baseNameA && baseNameA === baseNameB) {
          pairs.push([a, b]);
        }
      }
    }

    return pairs;
  }

  private columnNamesMatch(a: string, b: string): boolean {
    const normA = norm(a).replace(/^id_/i, '').replace(/_id$/i, '');
    const normB = norm(b).replace(/^id_/i, '').replace(/_id$/i, '');
    return normA === normB;
  }

  private extractBaseName(column: string): string | null {
    const match = column.match(/^(.+?)_?(?:id|key)$/i);
    return match ? norm(match[1]) : null;
  }

  private scoreRelationship([a, b]: [CatalogField, CatalogField]): AutoRelationship {
    const overlap = this.calculateOverlap(a.samples, b.samples);
    const aUniqueness = a.cardinality / Math.max(1, a.rowCount);
    const bUniqueness = b.cardinality / Math.max(1, b.rowCount);

    let confidence = 0.5;
    const reasoning: string[] = [];

    if (/id$/i.test(norm(a.column).replace(/ /g, ''))) {
      confidence += 0.15;
      reasoning.push('Left column ends with ID');
    }
    if (/id$/i.test(norm(b.column).replace(/ /g, ''))) {
      confidence += 0.15;
      reasoning.push('Right column ends with ID');
    }

    if (overlap >= this.config.minOverlap) {
      const overlapBonus = Math.min(0.25, overlap * 0.5);
      confidence += overlapBonus;
      reasoning.push(`Overlap: ${(overlap * 100).toFixed(0)}%`);
    }

    const oneSideLookup =
      (aUniqueness > 0.75 && bUniqueness < 0.95) || (bUniqueness > 0.75 && aUniqueness < 0.95);
    if (oneSideLookup) {
      confidence += 0.1;
      reasoning.push('One-to-many relationship pattern');
    }

    const tableMatch = this.columnNamesMatch(a.column, b.column);
    if (tableMatch) {
      confidence += 0.1;
      reasoning.push('Column names match');
    }

    const left: { table: string; column: string } =
      aUniqueness >= bUniqueness
        ? { table: a.table, column: a.column }
        : { table: b.table, column: b.column };
    const right: { table: string; column: string } =
      left === a ? { table: b.table, column: b.column } : { table: a.table, column: a.column };

    return {
      left,
      right,
      confidence: Math.min(1, confidence),
      overlap: Number(overlap.toFixed(3)),
      reasoning: reasoning.join('; ') || 'Inferred from key patterns',
    };
  }

  private calculateOverlap(aSamples: unknown[], bSamples: unknown[]): number {
    const aSet = new Set(aSamples.map(String));
    const bSet = new Set(bSamples.map(String));

    if (aSet.size === 0 || bSet.size === 0) return 0;

    let intersection = 0;
    for (const v of aSet) {
      if (bSet.has(v)) intersection++;
    }

    return intersection / Math.min(aSet.size, bSet.size);
  }

  findMissingRelationships(fields: CatalogField[], existing: Relationship[]): AutoRelationship[] {
    const entityTables = new Set(fields.filter((f) => f.role === 'key').map((f) => f.table));
    const connectedTables = new Set<string>();

    for (const rel of existing) {
      connectedTables.add(rel.left.table);
      connectedTables.add(rel.right.table);
    }

    const orphanTables = [...entityTables].filter(
      (t) => !connectedTables.has(t) && connectedTables.size > 0,
    );

    if (orphanTables.length === 0) return [];

    const keyFields = fields.filter((f) => f.role === 'key' || this.looksLikeKey(f));
    const candidates: AutoRelationship[] = [];

    for (const orphan of orphanTables) {
      for (const connected of connectedTables) {
        const orphanKey = keyFields.find((f) => f.table === orphan && this.looksLikeKey(f));
        const connectedKey = keyFields.find((f) => f.table === connected && this.looksLikeKey(f));

        if (
          orphanKey &&
          connectedKey &&
          this.columnNamesMatch(orphanKey.column, connectedKey.column)
        ) {
          candidates.push({
            left: { table: orphan, column: orphanKey.column },
            right: { table: connected, column: connectedKey.column },
            confidence: 0.5,
            overlap: 0,
            reasoning: `Possible missing relationship between ${orphan} and ${connected}`,
          });
        }
      }
    }

    return candidates;
  }
}

export class SemanticModelingEngine {
  private fieldRoleDetector: AutoFieldRoleDetector;
  private relationshipInferrer: AutoRelationshipInferrer;

  constructor() {
    this.fieldRoleDetector = new AutoFieldRoleDetector();
    this.relationshipInferrer = new AutoRelationshipInferrer();
  }

  async buildSemanticModel(
    fields: CatalogField[],
    existingOverrides?: Map<string, Partial<AutoFieldConfig>>,
    existingRelationships?: Relationship[],
  ): Promise<SemanticModelingResult> {
    const autoFields = new Map<string, AutoFieldConfig>();

    for (const field of fields) {
      const key = `${field.table}.${field.column}`;
      const override = existingOverrides?.get(key);

      if (override && Object.keys(override).length > 0) {
        continue;
      }

      const { role, confidence } = this.fieldRoleDetector.detectRole(field);

      const synonyms = this.fieldRoleDetector.generateSynonyms(field);
      const description = this.fieldRoleDetector.generateDescription(field);
      const aggregation = this.fieldRoleDetector.suggestAggregation(field);

      const autoConfig: AutoFieldConfig = {
        table: field.table,
        column: field.column,
        role,
        synonyms,
        description,
        priority: Math.round(confidence * 10),
      };

      if (role === 'measure' && aggregation) {
        autoConfig.aggregation = aggregation;
      }

      autoFields.set(key, autoConfig);
    }

    const { relationships, ambiguous } = this.relationshipInferrer.inferRelationships(fields);

    const suggestions = this.relationshipInferrer.findMissingRelationships(
      fields,
      existingRelationships || [],
    );

    return {
      autoFields,
      autoRelationships: [...relationships, ...suggestions],
      ambiguousRelationships: ambiguous,
    };
  }

  mergeWithOverrides(
    autoFields: Map<string, AutoFieldConfig>,
    overrides: Map<string, AutoFieldConfig>,
  ): Map<string, AutoFieldConfig> {
    const merged = new Map(autoFields);

    for (const [key, override] of overrides) {
      const auto = merged.get(key);
      if (auto) {
        merged.set(key, { ...auto, ...override });
      } else {
        merged.set(key, override);
      }
    }

    return merged;
  }

  generateFieldLabel(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\bid\b/gi, 'ID')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
