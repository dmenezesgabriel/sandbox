import type {
  DiagnosticDateParse,
  DiagnosticFilterSelectivity,
  DiagnosticJoinFanout,
  Diagnostics,
} from '../../../shared/types/index';
import { numberValue, toRows } from '../../../shared/utils/utils';

export class DiagnosticRunner {
  private query: (sql: string) => Promise<unknown>;

  constructor(query: (sql: string) => Promise<unknown>) {
    this.query = query;
  }

  async evaluateJoinFanout(fanout: DiagnosticJoinFanout): Promise<void> {
    if (!fanout?.baseCountSql || !fanout?.joinedCountSql) return;
    try {
      const baseRow = toRows(await this.query(fanout.baseCountSql))[0] || {};
      const joinedRow = toRows(await this.query(fanout.joinedCountSql))[0] || {};
      const baseCount = numberValue(baseRow.row_count ?? baseRow.rowCount ?? 0);
      const joinedCount = numberValue(joinedRow.row_count ?? joinedRow.rowCount ?? 0);
      let ratio: number;
      if (baseCount > 0) ratio = joinedCount / baseCount;
      else if (joinedCount > 0) ratio = Infinity;
      else ratio = 1;
      Object.assign(fanout, {
        baseCount,
        joinedCount,
        ratio: Number.isFinite(ratio) ? Number(ratio.toFixed(3)) : ratio,
      });
      if (
        joinedCount - baseCount >= (fanout.minExtraRows ?? 0) &&
        ratio >= (fanout.threshold ?? 1.5)
      ) {
        fanout.warning = `Joined row count is ${ratio.toFixed(1)}x the base ${fanout.baseTable} row count (${baseCount.toLocaleString()} → ${joinedCount.toLocaleString()}). This join may duplicate rows and inflate metrics.`;
      }
    } catch (err) {
      fanout.error = String(err);
    }
  }

  async evaluateFilterSelectivity(selectivity: DiagnosticFilterSelectivity): Promise<void> {
    if (!selectivity?.unfilteredCountSql || !selectivity?.filteredCountSql) return;
    try {
      const unfiltered = numberValue(
        (toRows(await this.query(selectivity.unfilteredCountSql))[0] || {}).row_count,
      );
      const filtered = numberValue(
        (toRows(await this.query(selectivity.filteredCountSql))[0] || {}).row_count,
      );
      const ratio = unfiltered > 0 ? filtered / unfiltered : 1;
      Object.assign(selectivity, {
        unfilteredCount: unfiltered,
        filteredCount: filtered,
        ratio: Number(ratio.toFixed(3)),
      });
      if (unfiltered && ratio < (selectivity.threshold ?? 0.1))
        selectivity.warning = `Filters keep only ${(ratio * 100).toFixed(1)}% of rows (${filtered.toLocaleString()} of ${unfiltered.toLocaleString()}). Results may be sparse.`;
    } catch (err) {
      selectivity.error = String(err);
    }
  }

  async evaluateDateParse(dateParse: DiagnosticDateParse): Promise<void> {
    if (!dateParse?.sql) return;
    try {
      const row = toRows(await this.query(dateParse.sql))[0] || {};
      const checkedRows = numberValue(row.checked_rows ?? row.checkedRows ?? 0);
      const droppedRows = numberValue(row.dropped_rows ?? row.droppedRows ?? 0);
      Object.assign(dateParse, { checkedRows, droppedRows });
      if (droppedRows > 0)
        dateParse.warning = `Date parsing dropped ${droppedRows.toLocaleString()} ${dateParse.field} rows.`;
    } catch (err) {
      dateParse.error = String(err);
    }
  }

  async evaluateDiagnostics(planned: Diagnostics): Promise<Diagnostics> {
    const diagnostics = structuredClone(planned || {});
    await this.evaluateJoinFanout(diagnostics.joinFanout!);
    await this.evaluateFilterSelectivity(diagnostics.filterSelectivity!);
    await this.evaluateDateParse(diagnostics.dateParse!);
    return diagnostics;
  }
}
