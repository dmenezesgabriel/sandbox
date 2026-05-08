import type { ChartConfiguration, ChartType } from 'chart.js';
import Chart from 'chart.js/auto';
import { html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';

import type { AskSuccessResult, CatalogField, CellValue, DataRow } from '../types';
import { formatValue, numberValue } from '../utils';

type RenderableChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'bubble' | 'histogram';

const RENDERABLE_CHARTS: RenderableChartType[] = [
  'bar', 'line', 'area', 'pie', 'donut', 'scatter', 'bubble', 'histogram',
];

const CHART_COLORS = ['#406ac1', '#6aa7e8', '#8fd0a6', '#f2bf5e', '#e07a72', '#8d7ae8', '#6cc5c0', '#c0d065'];

function isRenderable(value: string | undefined): value is RenderableChartType {
  return value !== undefined && RENDERABLE_CHARTS.includes(value as RenderableChartType);
}

function toChartJsType(type: RenderableChartType): ChartType {
  if (type === 'area') return 'line';
  if (type === 'donut') return 'doughnut';
  if (type === 'histogram') return 'bar';
  return type;
}

export class AskResult extends LitElement {
  static override readonly properties = {
    result: { type: Object },
  };

  result: AskSuccessResult | null = null;

  private _chart: Chart | null = null;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('result')) this._drawChart();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._destroyChart();
  }

  private _destroyChart(): void {
    try {
      this._chart?.destroy();
    } catch (err: unknown) {
      console.error('Chart destroy failed:', err);
    }
    this._chart = null;
  }

  private _drawChart(): void {
    this._destroyChart();
    const result = this.result;
    if (!result || !isRenderable(result.chartType)) return;
    const canvas = this.querySelector<HTMLCanvasElement>('#ask-data-chart');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const config = this._buildConfig(result, result.chartType);
    if (config) this._chart = new Chart(ctx, config);
  }

  private _buildConfig(result: AskSuccessResult, chartType: RenderableChartType): ChartConfiguration | null {
    const rows = result.rows || [];
    if (chartType === 'scatter' || chartType === 'bubble') return this._scatterConfig(result, chartType, rows);
    if (chartType === 'histogram') return this._histogramConfig(result, rows);
    return this._defaultConfig(result, chartType, rows);
  }

  private _defaultConfig(result: AskSuccessResult, chartType: RenderableChartType, rows: DataRow[]): ChartConfiguration {
    return {
      type: toChartJsType(chartType),
      data: {
        labels: rows.map((row) => String(row.label)),
        datasets: [{
          label: result.interpretation,
          data: rows.map((row) => numberValue(row.value)),
          fill: chartType === 'area',
          borderColor: '#406ac1',
          backgroundColor: chartType === 'area' ? '#406ac133' : CHART_COLORS,
        }],
      },
      options: {
        responsive: true,
        scales: chartType === 'bar' ? { y: { beginAtZero: true } } : {},
        plugins: { legend: { display: ['pie', 'donut'].includes(chartType) } },
      },
    };
  }

  private _scatterConfig(result: AskSuccessResult, chartType: 'scatter' | 'bubble', rows: DataRow[]): ChartConfiguration | null {
    const [xKey, yKey, rKey] = result.shape?.numeric || [];
    if (!xKey || !yKey) return null;
    return {
      type: chartType,
      data: {
        datasets: [{
          label: result.interpretation,
          data: rows.map((row) => ({
            x: numberValue(row[xKey]),
            y: numberValue(row[yKey]),
            r: Math.max(3, Math.sqrt(Math.abs(numberValue(row[rKey])) || 9)),
          })),
          backgroundColor: '#406ac188',
          borderColor: '#406ac1',
        }],
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: xKey } },
          y: { title: { display: true, text: yKey } },
        },
      },
    };
  }

  private _histogramConfig(result: AskSuccessResult, rows: DataRow[]): ChartConfiguration | null {
    const key = result.shape?.numeric?.[0] || 'value';
    const values = rows.map((row) => numberValue(row[key])).filter(Number.isFinite);
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(12, Math.max(3, Math.ceil(Math.sqrt(values.length))));
    const step = (max - min || 1) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({ start: min + i * step, count: 0 }));
    for (const v of values) bins[Math.min(binCount - 1, Math.floor((v - min) / step))].count++;
    return {
      type: 'bar',
      data: {
        labels: bins.map((b) => `${b.start.toFixed(0)}–${(b.start + step).toFixed(0)}`),
        datasets: [{ label: key, data: bins.map((b) => b.count), backgroundColor: '#406ac1' }],
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } },
    };
  }

  private _copyText(text: CellValue): void {
    navigator.clipboard?.writeText(String(text || '')).catch(() => {});
  }

  private _download(filename: string, text: string, type = 'text/plain'): void {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _toCsv(result: AskSuccessResult): string {
    const columns = result.columns || [];
    const esc = (v: CellValue): string => `"${String(v ?? '').replaceAll('"', '""')}"`;
    return [
      columns.map(esc).join(','),
      ...(result.rows || []).map((row) => columns.map((col) => esc(row[col])).join(',')),
    ].join('\n');
  }

  private _formatCell(col: string, value: CellValue, metric?: { format?: string }): string {
    if (value === null || value === undefined || value === '') return '';
    if (String(col).includes('percent') || col === 'share') return formatValue(value, 'percent');
    if (['value', 'previous_value', 'start_value', 'end_value', 'change'].includes(col))
      return formatValue(value, metric?.format);
    return String(value);
  }

  private _resolveMetric(result: AskSuccessResult): CatalogField | undefined {
    const intentMetric = result.intent.metric;
    if (intentMetric && 'table' in intentMetric) return intentMetric;
    if (intentMetric && 'kind' in intentMetric && intentMetric.kind === 'count_distinct')
      return intentMetric.field;
    return undefined;
  }

  private _renderTable(result: AskSuccessResult): TemplateResult {
    const columns = result.columns || [];
    const metric = this._resolveMetric(result);
    return html`
      <div class="ask-table-wrap">
        <table>
          <thead>
            <tr>${columns.map((col) => html`<th>${col}</th>`)}</tr>
          </thead>
          <tbody>
            ${(result.rows || []).map(
              (row) => html`
                <tr>${columns.map((col) => html`<td>${this._formatCell(col, row[col], metric)}</td>`)}</tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  private _renderKpi(result: AskSuccessResult): TemplateResult {
    const value = result.rows[0]?.value;
    const intentMetric = result.intent.metric;
    let metric: CatalogField | undefined;
    if (intentMetric && 'kind' in intentMetric) {
      metric = 'field' in intentMetric ? intentMetric.field : undefined;
    } else {
      metric = intentMetric ?? undefined;
    }
    return html`
      <div class="ask-kpi-value">${formatValue(value, metric?.format)}</div>
      ${this._renderTable(result)}
    `;
  }

  private _renderVisualization(result: AskSuccessResult): TemplateResult {
    if (result.chartType === 'kpi') return this._renderKpi(result);
    if (isRenderable(result.chartType)) {
      return html`
        <div class="ask-result-grid">
          <div><canvas id="ask-data-chart"></canvas></div>
          ${this._renderTable(result)}
        </div>
      `;
    }
    return this._renderTable(result);
  }

  private _renderDecision(result: AskSuccessResult): TemplateResult | typeof nothing {
    const decision = result.chartDecision;
    if (!decision) return nothing;
    return html`
      <div class="interpretation">
        <strong>Chart decision:</strong> ${decision.path.join(' → ')} → ${decision.rendered}.
        ${decision.reason}
      </div>
    `;
  }

  private _renderInsights(result: AskSuccessResult): TemplateResult | typeof nothing {
    if (!result.insights?.length) return nothing;
    return html`
      <div class="interpretation">
        <strong>Insights:</strong>
        <ul style="margin:.45rem 0 0 1.1rem;padding:0;">
          ${result.insights.map((insight) => html`<li>${insight}</li>`)}
        </ul>
      </div>
    `;
  }

  private _renderExports(result: AskSuccessResult): TemplateResult {
    return html`
      <div class="interpretation" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
        <strong>Export:</strong>
        <button class="choice-button" @click=${() => this._copyText(result.sql)}>Copy SQL</button>
        <button class="choice-button" @click=${() => this._download('ask-result.csv', this._toCsv(result), 'text/csv')}>
          Download CSV
        </button>
        <button
          class="choice-button"
          @click=${() =>
            this._download(
              'ask-result.json',
              JSON.stringify(
                { interpretation: result.interpretation, sql: result.sql, columns: result.columns, rows: result.rows },
                null,
                2,
              ),
              'application/json',
            )}
        >
          Download JSON
        </button>
      </div>
    `;
  }

  private _renderDetails(result: AskSuccessResult): TemplateResult {
    const joinFanout = result.diagnostics?.joinFanout;
    return html`
      <details class="sql-details">
        <summary>Show SQL and details</summary>
        <pre>${result.sql}</pre>
        <p><strong>Decision path:</strong> ${(result.chartDecision?.path || []).join(' → ')}</p>
        <p>
          <strong>Recommended chart:</strong> ${result.chartDecision?.recommended};
          <strong>Rendered:</strong> ${result.chartDecision?.rendered}
        </p>
        ${result.confidence !== undefined
          ? html`<p><strong>Confidence:</strong> ${Math.round(result.confidence * 100)}%</p>`
          : nothing}
        ${result.metrics
          ? html`<p>
              <strong>Latency:</strong> catalog ${result.metrics.catalogBuildMs ?? 'n/a'}ms; parse
              ${result.metrics.parseMs ?? 'n/a'}ms; SQL ${result.metrics.sqlExecutionMs ?? 'n/a'}ms;
              total ${result.metrics.totalAskMs ?? 'n/a'}ms.
            </p>`
          : nothing}
        ${joinFanout
          ? html`<p>
              <strong>Join fanout check:</strong>
              ${joinFanout.baseCount?.toLocaleString?.() || joinFanout.baseCount} base rows →
              ${joinFanout.joinedCount?.toLocaleString?.() || joinFanout.joinedCount}
              joined rows (${joinFanout.ratio}x).
            </p>`
          : nothing}
        ${result.evidence?.length
          ? html`
              <p><strong>Evidence:</strong></p>
              <ul>
                ${result.evidence.map((item) => {
                  const val = item.value !== undefined ? ` = ${item.value}` : '';
                  return html`<li>${item.kind}: ${item.field}${val} (${item.source})</li>`;
                })}
              </ul>
            `
          : nothing}
      </details>
    `;
  }

  override render(): TemplateResult | typeof nothing {
    const result = this.result;
    if (!result) return nothing;
    return html`
      <section class="ask-card">
        <div class="interpretation">
          <strong>Interpreted as:</strong> ${result.interpretation}
        </div>
        ${(result.warnings || []).map((w) => html`<div class="warning">${w}</div>`)}
        ${this._renderDecision(result)}
        ${this._renderInsights(result)}
        ${this._renderExports(result)}
        ${this._renderVisualization(result)}
        ${this._renderDetails(result)}
      </section>
    `;
  }
}

if (!customElements.get('ask-result')) {
  customElements.define('ask-result', AskResult);
}
