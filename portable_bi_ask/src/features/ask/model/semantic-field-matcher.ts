import type { CatalogField, SemanticMatchingConfig } from '../../../shared/types/index';
import { cosineSimilarity, norm } from '../../../shared/utils/utils';

export class SemanticFieldMatcher {
  config: SemanticMatchingConfig;
  helpers: {
    displayLabel?: (field: CatalogField) => string;
    localizedTerms?: (field: CatalogField) => string[];
  };
  enabled: boolean;
  model: string;
  dtype: string;
  minScore: number;
  minMargin: number;
  batchSize: number;
  extractor: unknown;
  catalogKey: string;
  index: { field: CatalogField; embedding: unknown }[];
  loading: Promise<boolean> | null;
  queryCache: Map<string, unknown>;

  constructor(
    config: SemanticMatchingConfig = {},
    helpers: {
      displayLabel?: (field: CatalogField) => string;
      localizedTerms?: (field: CatalogField) => string[];
    } = {},
  ) {
    this.config = config;
    this.helpers = helpers;
    this.enabled = config.enabled !== false;
    this.model = config.model || 'onnx-community/all-MiniLM-L6-v2-ONNX';
    this.dtype = config.dtype || 'q4';
    this.minScore = config.minScore ?? 0.42;
    this.minMargin = config.minMargin ?? 0.04;
    this.batchSize = config.batchSize || 16;
    this.extractor = null;
    this.catalogKey = '';
    this.index = [];
    this.loading = null;
    this.queryCache = new Map();
  }

  async matchField(text, roles, catalog) {
    const clean = norm(text);
    if (!this.enabled || !clean || clean.length < 2) return null;
    const ready = await this.initialize(catalog);
    if (!ready) return null;
    const embedding = await this.embedOne(clean);
    if (!embedding) return null;
    const scored = this.index
      .filter((item) => roles.includes(item.field.role))
      .map((item) => ({
        ...item,
        score: cosineSimilarity(
          embedding as ArrayLike<number>,
          item.embedding as ArrayLike<number>,
        ),
      }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < this.minScore) return null;
    const second = scored[1];
    if (second && best.score - second.score < this.minMargin) {
      return {
        ambiguous: true,
        fields: scored.slice(0, 4).map((item) => item.field),
        score: best.score,
      };
    }
    return { field: best.field, score: best.score };
  }

  async initialize(catalog) {
    const catalogKey = catalog.map((field) => field.id).join('|');
    if (this.extractor && this.catalogKey === catalogKey) return true;
    if (this.loading) return this.loading;
    this.loading = this.load(catalog, catalogKey);
    return this.loading;
  }

  async load(catalog, catalogKey) {
    try {
      const { pipeline, env, LogLevel } = await import('@huggingface/transformers');
      env.logLevel = LogLevel.ERROR;
      this.extractor = await pipeline('feature-extraction', this.model, {
        dtype: this.dtype as
          | 'q4'
          | 'auto'
          | 'fp32'
          | 'fp16'
          | 'q8'
          | 'int8'
          | 'uint8'
          | 'bnb4'
          | 'q4f16',
      });
      const texts = catalog.map((field) => this.fieldText(field));
      const embeddings = await this.embedBatch(texts);
      this.index = catalog
        .map((field, index) => ({ field, embedding: embeddings[index] }))
        .filter((item) => item.embedding);
      this.catalogKey = catalogKey;
      this.queryCache.clear();
      return true;
    } catch (err) {
      this.enabled = false;
      console.warn('[AskData] Semantic field matching disabled', err);
      return false;
    } finally {
      this.loading = null;
    }
  }

  fieldText(field) {
    const displayLabel = this.helpers.displayLabel?.(field) || field.label || field.column;
    const localizedTerms = this.helpers.localizedTerms?.(field) || [];
    return [
      `field: ${displayLabel}`,
      `column: ${field.column}`,
      `table: ${field.table}`,
      `role: ${field.role}`,
      field.description,
      ...(field.synonyms || []),
      ...localizedTerms,
    ]
      .filter(Boolean)
      .join('. ');
  }

  async embedOne(text) {
    const key = norm(text);
    if (this.queryCache.has(key)) return this.queryCache.get(key);
    const [embedding] = await this.embedBatch([text]);
    this.queryCache.set(key, embedding);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<unknown[]> {
    const vectors: unknown[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const output = await (
        this.extractor as (batch: string[], opts: Record<string, unknown>) => Promise<unknown>
      )(batch, { pooling: 'mean', normalize: true });
      vectors.push(...this.tensorRows(output));
    }
    return vectors;
  }

  tensorRows(tensor: unknown): unknown[] {
    const t = tensor as { dims?: number[]; data?: ArrayLike<number> };
    const dims = t.dims || [];
    const data = t.data || [];
    if (dims.length === 1) return [Float32Array.from(data as ArrayLike<number>)];
    const rows = dims[0] || 0;
    const width = dims.slice(1).reduce((product, value) => product * value, 1);
    const arr = data as ArrayLike<number> & { slice(start: number, end: number): unknown };
    return Array.from({ length: rows }, (_, row) => arr.slice(row * width, (row + 1) * width));
  }
}
