import type { AskIntent, CatalogField, DataRow, ResultShape } from '../../../shared/types/index';
import { formatValue } from '../../../shared/utils/utils';
import { type AnalysisFacts, ResultAnalyzer } from './result-analyzer';

export interface NarrativeConfig {
  maxNarratives: number;
  outlierThreshold: number;
  trendMinDataPoints: number;
  patternDetectionEnabled: boolean;
}

export interface Narrative {
  type: 'trend' | 'outlier' | 'pattern' | 'comparison' | 'distribution' | 'summary';
  title: string;
  text: string;
  importance: number;
  details?: Record<string, unknown>;
}

export interface NarrativeResult {
  narratives: Narrative[];
  summary: string;
  keyTakeaway: string;
}

export class NarrativeGenerator {
  private readonly config: NarrativeConfig;
  private readonly analyzer = new ResultAnalyzer();

  constructor(config?: Partial<NarrativeConfig>) {
    this.config = {
      maxNarratives: config?.maxNarratives ?? 5,
      outlierThreshold: config?.outlierThreshold ?? 1.5,
      trendMinDataPoints: config?.trendMinDataPoints ?? 3,
      patternDetectionEnabled: config?.patternDetectionEnabled ?? true,
    };
  }

  generateNarratives(
    rows: DataRow[],
    intent: AskIntent,
    shape: ResultShape,
    metricField?: CatalogField | null,
  ): NarrativeResult {
    if (!rows?.length) {
      return {
        narratives: [],
        summary: 'No data available to generate narratives.',
        keyTakeaway: 'Unable to provide insights due to lack of data.',
      };
    }

    const facts = this.analyzer.analyze(rows, intent, shape);
    const narratives: Narrative[] = [];

    if (facts.isTimeSeries) {
      narratives.push(...this.analyzeTimeSeries(facts));
      narratives.push(...this.analyzeTrendDirection(facts, metricField));
    }

    if (shape.categoricCount > 0 && shape.numericCount > 0) {
      narratives.push(...this.analyzeDistribution(facts, rows));
    }

    if (shape.numericCount > 0) {
      narratives.push(...this.detectOutliers(facts));
      narratives.push(...this.analyzeExtremes(facts, metricField));
    }

    if (this.hasComparison(intent)) {
      narratives.push(...this.analyzeComparisons(rows, intent, metricField));
    }

    narratives.push(...this.analyzePatterns(rows, intent, shape, facts));

    const ranked = narratives
      .sort((a, b) => b.importance - a.importance)
      .slice(0, this.config.maxNarratives);

    return {
      narratives: ranked,
      summary: this.generateSummary(ranked, intent, metricField),
      keyTakeaway: this.generateKeyTakeaway(ranked),
    };
  }

  private isGroupedMetric(intent: AskIntent, shape: ResultShape, facts: AnalysisFacts): boolean {
    return (
      intent.dimensions?.length > 0 &&
      shape.numericCount > 0 &&
      shape.categoricCount > 0 &&
      !facts.isTimeSeries
    );
  }

  private analyzeTimeSeries(facts: AnalysisFacts): Narrative[] {
    const narratives: Narrative[] = [];
    const { valid } = facts;

    if (valid.length < this.config.trendMinDataPoints) return narratives;

    const changes = this.calculatePeriodChanges(valid);
    if (changes.length === 0) return narratives;

    this.addConsistentTrendNarrative(narratives, changes, valid);
    this.addRecentTrendNarrative(narratives, changes, valid);

    return narratives;
  }

  private addConsistentTrendNarrative(
    narratives: Narrative[],
    changes: number[],
    valid: DataRow[],
  ): void {
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const consistentDirection = changes.every((c) => (avgChange >= 0 ? c >= 0 : c <= 0));

    if (!consistentDirection || Math.abs(avgChange) <= 0.05) return;

    const direction = avgChange >= 0 ? 'upward' : 'downward';
    const pct = Math.abs(avgChange);
    narratives.push({
      type: 'trend',
      title: `Consistent ${direction} movement`,
      text: `The metric shows consistent ${direction} movement with an average change of ${formatValue(pct, 'percent')} between periods.`,
      importance: 9,
      details: { avgChange, direction, periodCount: valid.length },
    });
  }

  private addRecentTrendNarrative(
    narratives: Narrative[],
    changes: number[],
    valid: DataRow[],
  ): void {
    if (changes.length < 2) return;

    const recentTrend = this.calculateRecentTrend(valid);
    if (recentTrend === null) return;

    const trendDirection = recentTrend >= 0 ? 'accelerating' : 'decelerating';
    narratives.push({
      type: 'trend',
      title: `Recent trend ${trendDirection}`,
      text: `The recent data points suggest the trend is ${trendDirection}. ${
        recentTrend >= 0
          ? 'Each subsequent period shows higher values.'
          : 'Each subsequent period shows lower values.'
      }`,
      importance: 8,
      details: { recentTrend, trendDirection },
    });
  }

  private calculatePeriodChanges(rows: DataRow[]): number[] {
    const changes: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = Number(rows[i - 1].value);
      const curr = Number(rows[i].value);
      if (prev !== 0) {
        changes.push((curr - prev) / Math.abs(prev));
      }
    }
    return changes;
  }

  private calculateRecentTrend(rows: DataRow[]): number | null {
    if (rows.length < 3) return null;

    const lastThird = rows.slice(Math.floor((rows.length * 2) / 3));
    const firstThird = rows.slice(0, Math.floor(rows.length / 3));

    const avgFirst = firstThird.reduce((s, r) => s + Number(r.value), 0) / firstThird.length;
    const avgLast = lastThird.reduce((s, r) => s + Number(r.value), 0) / lastThird.length;

    if (avgFirst === 0) return null;

    return (avgLast - avgFirst) / Math.abs(avgFirst);
  }

  private analyzeTrendDirection(
    facts: AnalysisFacts,
    metricField?: CatalogField | null,
  ): Narrative[] {
    const narratives: Narrative[] = [];
    if (facts.valid.length < 2 || facts.trendChange === null) return narratives;

    const metricFormat = metricField?.format;
    const first = Number(facts.valid[0].value);
    const totalChange = facts.trendChange;
    const pctChange = facts.trendPct ?? 0;

    const direction = totalChange >= 0 ? 'increase' : 'decrease';
    const pctStr =
      Math.abs(pctChange) > 0.01 ? ` (${formatValue(Math.abs(pctChange), 'percent')})` : '';

    narratives.push({
      type: 'trend',
      title: `Overall ${direction}`,
      text: `From the first to the last period, the metric ${direction}d by ${formatValue(Math.abs(totalChange), metricFormat)}${pctStr}.`,
      importance: 7,
      details: {
        first,
        last: Number(facts.valid[facts.valid.length - 1].value),
        totalChange,
        pctChange,
      },
    });

    return narratives;
  }

  private analyzeDistribution(facts: AnalysisFacts, _rows: DataRow[]): Narrative[] {
    const narratives: Narrative[] = [];
    const { valid, total, topNShare } = facts;
    if (valid.length < 3) return narratives;

    if (topNShare !== null && topNShare > 0.6) {
      const labels = [...valid]
        .sort((a, b) => Number(b.value) - Number(a.value))
        .slice(0, 3)
        .map((r) => String(r.label))
        .join(', ');

      narratives.push({
        type: 'distribution',
        title: 'Concentrated distribution',
        text: `The top 3 groups (${labels}) account for ${formatValue(topNShare, 'percent')} of the total, indicating a concentrated distribution.`,
        importance: 8,
        details: { top3Share: topNShare, topGroups: labels },
      });
    }

    const lowShare = valid.filter((r) => Number(r.value) < total * 0.05);
    if (lowShare.length > valid.length * 0.3 && valid.length > 5) {
      narratives.push({
        type: 'distribution',
        title: 'Long tail pattern',
        text: `${lowShare.length} groups have less than 5% share, suggesting a long-tail distribution with many small contributors.`,
        importance: 6,
        details: { lowShareCount: lowShare.length },
      });
    }

    return narratives;
  }

  private detectOutliers(facts: AnalysisFacts): Narrative[] {
    const narratives: Narrative[] = [];
    const { valid, mean, stdDev } = facts;
    if (valid.length < 4 || stdDev === 0) return narratives;

    const threshold = this.config.outlierThreshold;
    const outliers = valid.filter((r) => Math.abs(Number(r.value) - mean) > threshold * stdDev);

    if (outliers.length > 0) {
      this.addOutlierNarrative(narratives, outliers, mean);
    }

    return narratives;
  }

  private addOutlierNarrative(narratives: Narrative[], outliers: DataRow[], mean: number): void {
    const highOutliers = outliers.filter((o) => Number(o.value) > mean);
    const lowOutliers = outliers.filter((o) => Number(o.value) < mean);
    const outlierType = this.classifyOutlierType(highOutliers.length, lowOutliers.length);
    const outlierLabels = outliers
      .slice(0, 3)
      .map((r) => String(r.label))
      .join(', ');

    narratives.push({
      type: 'outlier',
      title: `${this.outlierTitle(outlierType)} outliers detected`,
      text: `${outliers.length} group(s) stand out as ${this.outlierDescription(outlierType)} the average: ${outlierLabels}.`,
      importance: 9,
      details: { outlierCount: outliers.length, outlierType, outlierLabels },
    });
  }

  private classifyOutlierType(highCount: number, lowCount: number): string {
    if (highCount > lowCount) return 'high';
    if (lowCount > highCount) return 'low';
    return 'mixed';
  }

  private outlierDescription(outlierType: string): string {
    if (outlierType === 'mixed') return 'significantly different from';
    if (outlierType === 'high') return 'significantly above';
    return 'significantly below';
  }

  private outlierTitle(outlierType: string): string {
    if (outlierType === 'high') return 'High';
    if (outlierType === 'low') return 'Low';
    return 'Mixed';
  }

  private analyzeExtremes(facts: AnalysisFacts, metricField?: CatalogField | null): Narrative[] {
    const narratives: Narrative[] = [];
    const { valid, sorted, total, top, bottom } = facts;
    if (valid.length === 0 || !top) return narratives;

    const hasLabels = valid.some((r) => r.label !== undefined && r.label !== null);

    const metricFormat = metricField?.format;
    const metricLbl = metricField?.label || 'metric';

    const topLabel = hasLabels ? String(top.label) : metricLbl;
    const bottomLabel =
      hasLabels && bottom && bottom.label !== undefined ? String(bottom.label) : null;

    narratives.push({
      type: 'pattern',
      title: 'Highest performer',
      text: `${topLabel} leads with ${formatValue(top.value, metricFormat)}${
        total > 0 ? ` (${formatValue(Number(top.value) / total, 'percent')} of total)` : ''
      }.`,
      importance: 7,
      details: { topLabel, topValue: top.value },
    });

    if (bottomLabel && bottomLabel !== topLabel && valid.length > 2) {
      narratives.push({
        type: 'pattern',
        title: 'Lowest performer',
        text: `${bottomLabel} has the lowest value at ${formatValue(bottom!.value, metricFormat)}.`,
        importance: 5,
        details: { bottomLabel, bottomValue: bottom!.value },
      });
    }

    if (sorted.length >= 3) {
      const topShare = Number(sorted[0].value) / total;
      if (topShare > 0.4) {
        narratives.push({
          type: 'pattern',
          title: 'Market leader dominance',
          text: `The top category represents ${formatValue(topShare, 'percent')} of total, showing significant leader dominance.`,
          importance: 7,
          details: { topShare },
        });
      }
    }

    return narratives;
  }

  private hasComparison(intent: AskIntent): boolean {
    return intent.analysisType === 'comparison' || intent.shareValues?.length !== undefined;
  }

  private analyzeComparisons(
    rows: DataRow[],
    intent: AskIntent,
    _metricField?: CatalogField | null,
  ): Narrative[] {
    const narratives: Narrative[] = [];

    if (intent.analysisType === 'comparison' && rows.length >= 2) {
      const sorted = [...rows].sort((a, b) => Number(b.value) - Number(a.value));
      const diff = Math.abs(Number(sorted[0].value) - Number(sorted[1].value));
      const avg = rows.reduce((s, r) => s + Number(r.value), 0) / rows.length;

      if (avg > 0) {
        const diffPct = diff / avg;
        if (diffPct > 0.3) {
          narratives.push({
            type: 'comparison',
            title: 'Significant gap between values',
            text: `The values differ significantly, with the highest being ${formatValue(diffPct, 'percent')} above the average.`,
            importance: 8,
            details: { diff, diffPct },
          });
        }
      }
    }

    return narratives;
  }

  private analyzePatterns(
    rows: DataRow[],
    intent: AskIntent,
    shape: ResultShape,
    facts: AnalysisFacts,
  ): Narrative[] {
    const narratives: Narrative[] = [];

    if (!this.config.patternDetectionEnabled || rows.length < 3) return narratives;

    if (this.isGroupedMetric(intent, shape, facts)) {
      narratives.push(...this.analyzeGroupedPattern(facts));
    }

    return narratives;
  }

  private analyzeGroupedPattern(facts: AnalysisFacts): Narrative[] {
    const narratives: Narrative[] = [];
    const { valid } = facts;
    if (valid.length < 5) return narratives;

    const values = valid.map((r) => Number(r.value));
    const sortedDesc = [...values].sort((a, b) => b - a);

    const isSortedDesc = values.every((v, i) => i === 0 || v <= sortedDesc[i]);

    if (isSortedDesc) {
      narratives.push({
        type: 'pattern',
        title: 'Descending rank order',
        text: 'Values are organized in descending order, showing clear ranking from highest to lowest.',
        importance: 4,
      });
    }

    const gaps: number[] = [];
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      if (prev > 0) {
        gaps.push((prev - curr) / prev);
      }
    }

    if (gaps.length > 0) {
      const maxGap = Math.max(...gaps);
      const maxGapIndex = gaps.indexOf(maxGap);
      if (maxGap > 0.25) {
        const gapLabel = valid[maxGapIndex]?.label;
        narratives.push({
          type: 'pattern',
          title: 'Notable drop detected',
          text: `There is a significant drop between ${gapLabel} and the next group, indicating a natural break in the data.`,
          importance: 7,
          details: { maxGap, gapIndex: maxGapIndex },
        });
      }
    }

    return narratives;
  }

  private generateSummary(
    narratives: Narrative[],
    intent: AskIntent,
    metricField?: CatalogField | null,
  ): string {
    if (narratives.length === 0) {
      return 'The data shows no particularly notable patterns or trends.';
    }

    const validNarratives = narratives.filter((n) => n.text && !n.text.includes('undefined'));
    if (validNarratives.length === 0) {
      return 'Analysis complete. Check the data for patterns.';
    }

    const metricName = metricField?.label || 'metric';
    const dimensionLabel = intent.dimensions?.[0]?.label || 'groups';

    const trendNarratives = validNarratives.filter((n) => n.type === 'trend');
    const outlierNarratives = validNarratives.filter((n) => n.type === 'outlier');

    if (trendNarratives.length > 0) {
      return `Analysis of ${metricName} by ${dimensionLabel} reveals ${trendNarratives[0].text}`;
    }

    if (outlierNarratives.length > 0) {
      return `Notable findings: ${outlierNarratives[0].text}`;
    }

    const first = validNarratives[0];
    return first ? `Key insight: ${first.text}` : 'Data analysis complete.';
  }

  private generateKeyTakeaway(narratives: Narrative[]): string {
    if (narratives.length === 0) {
      return 'No significant insights detected in this dataset.';
    }

    const highPriority = narratives.filter(
      (n) => n.importance >= 8 && n.text && !n.text.includes('undefined'),
    );
    if (highPriority.length > 0) {
      return highPriority[0].text;
    }

    const validNarratives = narratives.filter((n) => n.text && !n.text.includes('undefined'));
    if (validNarratives.length > 0) {
      return validNarratives[0].text;
    }

    return 'Analysis complete. Check the narratives above for details.';
  }

  generateNaturalLanguageQuestion(summary: string, intent: AskIntent): string {
    const question = intent.question || '';

    const verb = intent.analysisType === 'trend' ? 'over time' : 'by category';

    return `Showing ${question.replace(/\?$/, '')} ${verb}`;
  }
}
