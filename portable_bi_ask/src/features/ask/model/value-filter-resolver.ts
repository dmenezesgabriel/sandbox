import type {
  CatalogField,
  ClarificationPending,
  IntentFilter,
  ValueFuse,
  ValueItem,
} from '../../../shared/types/index';
import { escapeRegExp, norm } from '../../../shared/utils/utils';

export class ValueFilterResolver {
  valueItems: () => ValueItem[];
  valueFuse: () => ValueFuse | null;
  valuePhraseMaxWords: () => number;
  displayLabel: (field: CatalogField) => string;
  localizedTerms: (field: CatalogField) => string[];

  constructor({
    valueItems,
    valueFuse,
    valuePhraseMaxWords,
    displayLabel,
    localizedTerms,
  }: {
    valueItems: () => ValueItem[];
    valueFuse: () => ValueFuse | null;
    valuePhraseMaxWords: () => number;
    displayLabel: (field: CatalogField) => string;
    localizedTerms: (field: CatalogField) => string[];
  }) {
    this.valueItems = valueItems;
    this.valueFuse = valueFuse;
    this.valuePhraseMaxWords = valuePhraseMaxWords;
    this.displayLabel = displayLabel;
    this.localizedTerms = localizedTerms;
  }

  resolve(q, clarification: ClarificationPending | null | undefined = null) {
    const matches = this.findMatches(q);
    const byValue = new Map<string, ValueItem[]>();
    for (const match of matches.sort(
      (a, b) => b.normalizedValue.length - a.normalizedValue.length,
    )) {
      if ([...byValue.keys()].some((v) => v.includes(match.normalizedValue))) continue;
      if (!byValue.has(match.normalizedValue)) byValue.set(match.normalizedValue, []);
      const bucket = byValue.get(match.normalizedValue);
      if (bucket) bucket.push(match);
    }
    return this.toFilters(q, byValue, clarification);
  }

  findMatches(q) {
    const matches: ValueItem[] = [];
    const seen = new Set<string>();
    const addMatch = (item: ValueItem, matchScore = 1, matchSource = 'exact') => {
      const key = `${item.field.id}::${item.normalizedValue}`;
      const enriched = { ...item, matchScore, matchSource };
      if (!seen.has(key)) {
        seen.add(key);
        matches.push(enriched);
      } else {
        const existing = matches.find(
          (m) => `${m.field.id}::${m.normalizedValue}` === key,
        ) as ValueItem & { matchScore?: number };
        if (existing && matchScore > (existing.matchScore || 0)) Object.assign(existing, enriched);
      }
    };
    for (const item of this.valueItems()) {
      const v = item.normalizedValue;
      if (!v || v.length < 2) continue;
      const pattern = `\\b${escapeRegExp(v).replace(/\s+/g, '\\s+')}\\b`;
      if (new RegExp(pattern).test(q)) addMatch(item, 1, 'exact_value');
    }
    const fuse = this.valueFuse();
    if (fuse) this.addFuseMatches(q, fuse, addMatch);
    return matches;
  }

  addFusePhrase(
    phrase: string,
    size: number,
    fuse: ValueFuse,
    addMatch: (item: ValueItem, score: number, source: string) => void,
  ) {
    if (phrase.length < 4) return;
    for (const result of fuse.search(phrase, { limit: 3 })) {
      const itemWordCount = result.item.normalizedValue.split(/\s+/).length;
      if (itemWordCount !== size) continue;
      const fuzzyLimit = itemWordCount > 1 ? 0.025 : 0.001;
      if ((result.score ?? 1) <= fuzzyLimit)
        addMatch(result.item, Math.max(0.75, 1 - (result.score || 0) * 10), 'fuzzy_value');
    }
  }

  addFuseMatches(
    q: string,
    fuse: ValueFuse,
    addMatch: (item: ValueItem, score: number, source: string) => void,
  ) {
    const words = q.split(/\s+/).filter(Boolean);
    const maxWindow = Math.min(this.valuePhraseMaxWords() || 1, 8, words.length);
    for (let size = 1; size <= maxWindow; size++) {
      for (let start = 0; start + size <= words.length; start++) {
        const phrase = words.slice(start, start + size).join(' ');
        this.addFusePhrase(phrase, size, fuse, addMatch);
      }
    }
  }

  resolveAmbiguousField(q, items, uniqueFields, clarification) {
    const clarified =
      clarification?.slot === 'filterField' &&
      clarification.valueNormalized === items[0].normalizedValue
        ? uniqueFields.find((i) => i.field.id === clarification.fieldId)
        : null;
    const cueHasFieldName =
      clarified ||
      uniqueFields.find((i) =>
        [this.displayLabel(i.field), i.field.label, i.field.column, ...this.localizedTerms(i.field)]
          .map(norm)
          .some((term) => term && q.includes(term)),
      );
    return { clarified, cueHasFieldName };
  }

  toFilters(
    q,
    byValue: Map<string, ValueItem[]>,
    clarification: ClarificationPending | null | undefined = null,
  ) {
    const filters: IntentFilter[] = [];
    for (const [, items] of byValue) {
      const uniqueFields = [...new Map(items.map((i) => [i.field.id, i])).values()];
      if (uniqueFields.length > 1) {
        const { clarified, cueHasFieldName } = this.resolveAmbiguousField(
          q,
          items,
          uniqueFields,
          clarification,
        );
        if (cueHasFieldName) {
          filters.push({
            field: cueHasFieldName.field,
            operator: '=',
            value: cueHasFieldName.value,
            score: cueHasFieldName.matchScore || 0.9,
            source: clarified ? 'clarification' : cueHasFieldName.matchSource,
          });
        } else {
          const candidates = uniqueFields.slice(0, 5).map((i) => ({
            label: `${i.field.label} = ${i.value}`,
            fieldId: i.field.id,
            fieldLabel: i.field.label,
            table: i.field.table,
            column: i.field.column,
            value: i.value,
            valueNormalized: i.normalizedValue,
          }));
          return {
            clarification: {
              message: `Which field should "${items[0].value}" filter?`,
              pending: {
                slot: 'filterField',
                originalQuestion: null,
                value: items[0].value,
                valueNormalized: items[0].normalizedValue,
                candidates,
              },
              choices: candidates,
            },
          };
        }
      } else {
        const item = uniqueFields[0];
        filters.push({
          field: item.field,
          operator: '=',
          value: item.value,
          score: (item as ValueItem & { matchScore?: number }).matchScore || 0.9,
          source: (item as ValueItem & { matchSource?: string }).matchSource,
        });
      }
    }
    return { filters };
  }
}
