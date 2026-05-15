import type { AskIntent, DataRow, ResultShape } from '../../../shared/types/index';

export interface AnalysisFacts {
  valid: DataRow[];
  sorted: DataRow[];
  total: number;
  mean: number;
  stdDev: number;
  top: DataRow | undefined;
  bottom: DataRow | undefined;
  topNShare: number | null;
  isTimeSeries: boolean;
  trendChange: number | null;
  trendPct: number | null;
}

export class ResultAnalyzer {
  analyze(rows: DataRow[], intent: AskIntent, shape: ResultShape): AnalysisFacts {
    const valid = (rows ?? []).filter(
      (r) => r.value !== null && r.value !== undefined && Number.isFinite(Number(r.value)),
    );
    const total = valid.reduce((sum, r) => sum + Number(r.value), 0);
    const sorted = [...valid].sort((a, b) => Number(b.value) - Number(a.value));
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];

    const mean = valid.length ? total / valid.length : 0;
    const stdDev = valid.length
      ? Math.sqrt(
          valid.reduce((sum, r) => sum + Math.pow(Number(r.value) - mean, 2), 0) / valid.length,
        )
      : 0;

    const topN = sorted.slice(0, Math.min(3, sorted.length));
    const topNShare =
      valid.length >= 3 && total ? topN.reduce((sum, r) => sum + Number(r.value), 0) / total : null;

    const isTimeSeries = Boolean(
      intent.dimensions?.some((d) => d.role === 'time') ||
      intent.analysisType === 'trend' ||
      shape.timeCount > 0,
    );

    let trendChange: number | null = null;
    let trendPct: number | null = null;
    if (isTimeSeries && valid.length >= 2) {
      const first = Number(valid[0].value);
      const last = Number(valid[valid.length - 1].value);
      trendChange = last - first;
      trendPct = first !== 0 ? trendChange / Math.abs(first) : null;
    }

    return {
      valid,
      sorted,
      total,
      mean,
      stdDev,
      top,
      bottom,
      topNShare,
      isTimeSeries,
      trendChange,
      trendPct,
    };
  }
}
