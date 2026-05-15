import { escapeRegExp, norm } from '../../../shared/utils/utils';

export class MonthCatalog {
  locale: string;
  months: { term: string; number: number }[];

  constructor(locale: string) {
    this.locale = locale || 'en-US';
    this.months = this.buildMonths();
  }

  buildMonths() {
    const locales = [...new Set(['en-US', 'pt-BR', this.locale])];
    const byTerm = new Map();
    for (let month = 0; month < 12; month++) {
      for (const locale of locales) {
        for (const style of ['long', 'short'] as const) {
          const label = new Intl.DateTimeFormat(locale, { month: style })
            .format(new Date(2024, month, 15))
            .replace(/\.$/, '');
          for (const term of [label, norm(label)]) {
            if (term) byTerm.set(term.toLowerCase(), month + 1);
          }
        }
      }
    }
    return [...byTerm.entries()]
      .map(([term, number]) => ({ term, number }))
      .sort((a, b) => b.term.length - a.term.length);
  }

  find(text) {
    for (const item of this.months) {
      const pattern = new RegExp(`\\b${escapeRegExp(item.term)}\\b(?:\\s+((?:19|20)\\d{2}))?`, 'i');
      const match = String(text || '').match(pattern);
      if (match)
        return {
          ...item,
          text: match[0],
          index: match.index ?? 0,
          year: match[1] ? Number(match[1]) : null,
        };
    }
    return null;
  }

  has(text) {
    return !!this.find(text);
  }
}
