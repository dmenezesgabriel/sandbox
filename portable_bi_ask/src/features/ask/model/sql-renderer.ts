import type { CellValue, WhereCondition } from '../../../shared/types/index';
import { escapeSqlString, quoteIdent } from '../../../shared/utils/utils';

export class SqlRenderer {
  renderCondition(cond: Exclude<WhereCondition, { kind: 'date_range' }>): string {
    switch (cond.kind) {
      case 'eq':
        return `${cond.tableAlias}.${quoteIdent(cond.column)} = '${escapeSqlString(cond.value)}'`;
      case 'in': {
        const list = cond.values.map((v) => `'${escapeSqlString(v)}'`).join(', ');
        return `${cond.tableAlias}.${quoteIdent(cond.column)} IN (${list})`;
      }
      case 'month_of_year':
        return `EXTRACT(month FROM ${cond.dateExpr}) = ${Number(cond.month)}`;
    }
  }

  renderEscapedList(values: CellValue[]): string {
    return values.map((v) => `'${escapeSqlString(v)}'`).join(', ');
  }

  renderConditions(conds: WhereCondition[]): string[] {
    const parts: string[] = [];
    for (const cond of conds) {
      if (cond.kind === 'date_range') {
        parts.push(`${cond.dateExpr} >= DATE '${cond.start}'`);
        parts.push(`${cond.dateExpr} < DATE '${cond.end}'`);
      } else {
        parts.push(this.renderCondition(cond));
      }
    }
    return parts;
  }
}
