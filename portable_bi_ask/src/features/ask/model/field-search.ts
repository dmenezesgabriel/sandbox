import MiniSearch from 'minisearch';

import type {
  CatalogField,
  ClarificationPending,
  FieldFuse,
  FieldRole,
  FieldSearchIndexType,
} from '../../../shared/types/index';
import { norm, singularize } from '../../../shared/utils/utils';
import { SemanticFieldMatcher } from './semantic-field-matcher';
import { TermMatcher } from './term-matcher';

export class FieldSearchIndex {
  catalog: () => CatalogField[];
  displayLabel: (field: CatalogField) => string;
  localizedTerms: (field: CatalogField) => string[];
  fieldById: Map<string, CatalogField>;
  index: FieldSearchIndexType;

  constructor({
    catalog,
    displayLabel,
    localizedTerms,
  }: {
    catalog: () => CatalogField[];
    displayLabel: (field: CatalogField) => string;
    localizedTerms: (field: CatalogField) => string[];
  }) {
    this.catalog = catalog;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.fieldById = new Map();
    this.index = new MiniSearch({
      fields: ['text'],
      storeFields: ['role'],
      searchOptions: { combineWith: 'AND' },
    });
  }

  rebuild() {
    this.index = new MiniSearch({
      fields: ['text'],
      storeFields: ['role'],
      searchOptions: { combineWith: 'AND' },
    });
    this.fieldById.clear();
    const docs = this.catalog().map((field) => {
      this.fieldById.set(field.id, field);
      return {
        id: field.id,
        role: field.role,
        text: norm(
          [
            this.displayLabel(field),
            field.label,
            field.column,
            field.table,
            field.role,
            field.description,
            ...(field.synonyms || []),
            ...Object.values(field.localizedSynonyms || {}).flat(),
            ...this.localizedTerms(field),
          ]
            .filter(Boolean)
            .join(' '),
        ),
      };
    });
    this.index.addAll(docs);
  }

  search(query, roles): { field: CatalogField; score: number }[] {
    const clean = norm(query);
    if (!clean) return [];
    return this.index
      .search(clean, { combineWith: 'AND' })
      .filter((result) => roles.includes(result.role))
      .map((result) => ({ field: this.fieldById.get(result.id), score: result.score }))
      .filter((result): result is { field: CatalogField; score: number } => !!result.field)
      .sort((a, b) => b.score - a.score);
  }
}

export class TextSearchFieldMatchStrategy {
  fieldSearchIndex: () => FieldSearchIndex | null;

  constructor({ fieldSearchIndex }: { fieldSearchIndex: () => FieldSearchIndex | null }) {
    this.fieldSearchIndex = fieldSearchIndex;
  }

  async matchPhrase(phrase, roles) {
    const index = this.fieldSearchIndex();
    if (!index) return null;
    const results = index.search(phrase, roles).slice(0, 4);
    if (!results.length || results[0].score < 0.9) return null;
    if (results[1] && results[0].score - results[1].score < 0.15)
      return {
        ambiguous: true,
        fields: results.map((result) => result.field).filter((f): f is CatalogField => !!f),
        score: results[0].score,
      };
    return { field: results[0].field, score: Math.min(0.9, results[0].score / 3) };
  }

  async findInText(text, role) {
    const index = this.fieldSearchIndex();
    if (!index) return null;
    const result = index.search(text, [role])[0];
    return result && result.score >= 1.1 ? (result.field ?? null) : null;
  }
}

export class ExactFieldMatchStrategy {
  catalog: () => CatalogField[];
  displayLabel: (field: CatalogField) => string;
  localizedTerms: (field: CatalogField) => string[];
  termMatcher: TermMatcher;

  constructor({
    catalog,
    displayLabel,
    localizedTerms,
    termMatcher,
  }: {
    catalog: () => CatalogField[];
    displayLabel: (field: CatalogField) => string;
    localizedTerms: (field: CatalogField) => string[];
    termMatcher: TermMatcher;
  }) {
    this.catalog = catalog;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
    this.termMatcher = termMatcher;
  }

  async matchPhrase(phrase, roles) {
    const clean = norm(phrase);
    if (!clean) return { field: null };
    const direct = this.directMatches(clean, roles);
    if (!direct.length) return null;
    direct.sort((a, b) => b.score - a.score);
    if (direct[1] && direct[0].score - direct[1].score < 0.03)
      return { ambiguous: true, fields: direct.slice(0, 4).map((match) => match.field) };
    return { field: direct[0].field };
  }

  async findInText(text, role) {
    const candidates: { field: CatalogField; score: number }[] = [];
    for (const field of this.catalog().filter((field) => field.role === role)) {
      for (const term of this.fieldTerms(field)) {
        if (this.termMatcher.patternFromTerm(term)?.test(text)) {
          candidates.push({
            field,
            score:
              term.length +
              (field.priority || 0) +
              (this.activeTerms(field).includes(term) ? 10 : 0),
          });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.field || null;
  }

  directMatches(clean, roles) {
    const byField = new Map();
    for (const field of this.catalog().filter((field) => roles.includes(field.role))) {
      for (const term of this.fieldTerms(field)) {
        if (clean === term || clean === singularize(term) || term === singularize(clean)) {
          const score =
            1 + (field.priority || 0) / 100 + (this.activeTerms(field).includes(term) ? 0.1 : 0);
          const previous = byField.get(field.id);
          if (!previous || score > previous.score) byField.set(field.id, { field, score });
        }
      }
    }
    return [...byField.values()];
  }

  fieldTerms(field) {
    return [
      ...new Set(
        [field.label, field.column, ...(field.synonyms || []), ...this.activeTerms(field)]
          .map(norm)
          .filter(Boolean),
      ),
    ];
  }

  activeTerms(field) {
    return [this.displayLabel(field), ...this.localizedTerms(field)].map(norm).filter(Boolean);
  }
}

export class FuseFieldMatchStrategy {
  fieldFuse: () => FieldFuse | null;

  constructor({ fieldFuse }: { fieldFuse: () => FieldFuse | null }) {
    this.fieldFuse = fieldFuse;
  }

  async matchPhrase(phrase, roles) {
    const fuse = this.fieldFuse();
    if (!fuse) return null;
    const results = fuse
      .search(norm(phrase))
      .filter((result) => roles.includes(result.item.field.role))
      .slice(0, 4);
    if (!results.length || (results[0].score ?? 0) > 0.28) return null;
    if (results[1] && (results[1].score ?? 1) - (results[0].score ?? 0) < 0.04)
      return {
        ambiguous: true,
        fields: results.map((result) => result.item.field).filter((f): f is CatalogField => !!f),
      };
    return { field: results[0].item.field };
  }
}

export class SemanticFieldMatchStrategy {
  semanticMatcher: SemanticFieldMatcher;
  catalog: () => CatalogField[];

  constructor({
    semanticMatcher,
    catalog,
  }: {
    semanticMatcher: SemanticFieldMatcher;
    catalog: () => CatalogField[];
  }) {
    this.semanticMatcher = semanticMatcher;
    this.catalog = catalog;
  }

  async matchPhrase(phrase, roles) {
    return this.semanticMatcher.matchField(norm(phrase), roles, this.catalog());
  }

  async findInText(text, role) {
    const result = await this.semanticMatcher.matchField(text, [role], this.catalog());
    return result?.ambiguous ? null : result?.field || null;
  }
}

export class FieldResolver {
  strategies: Array<{
    matchPhrase?: (phrase: string, roles: FieldRole[]) => Promise<unknown>;
    findInText?: (text: string, role: FieldRole) => Promise<CatalogField | null>;
  }>;
  clarify: (
    pending: ClarificationPending,
    message: string,
    fields: CatalogField[],
  ) => { field?: CatalogField; clarification?: unknown };

  constructor(strategies: FieldResolver['strategies'], clarify: FieldResolver['clarify']) {
    this.strategies = strategies;
    this.clarify = clarify;
  }

  async resolvePhrase(
    phrase,
    roles,
    clarification: ClarificationPending | null | undefined = null,
  ) {
    if (!norm(phrase)) return { field: undefined };
    for (const strategy of this.strategies) {
      const raw = await strategy.matchPhrase?.(phrase, roles);
      if (!raw) continue;
      const result = raw as {
        field?: CatalogField | null;
        ambiguous?: boolean;
        fields?: CatalogField[];
        score?: number;
      };
      if (result.ambiguous) {
        const fields = result.fields || [];
        const clarified =
          clarification?.slot === 'field' && norm(clarification.phrase as string) === norm(phrase)
            ? fields.find((field) => field.id === clarification.fieldId)
            : null;
        if (clarified) return { field: clarified };
        return this.clarify(
          { slot: 'field', originalQuestion: null, phrase, roles },
          `Which field did you mean by "${phrase}"?`,
          fields,
        );
      }
      if (result.field) return { field: result.field };
    }
    return { field: undefined };
  }

  async findInText(text, role) {
    for (const strategy of this.strategies) {
      const field = await strategy.findInText?.(text, role);
      if (field) return field;
    }
    return null;
  }
}
