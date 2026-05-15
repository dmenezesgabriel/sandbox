import '../../../../shared/ui/ui-button';

import Chart from 'chart.js/auto';
import { html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';

import type { AskSuccessResult, CellValue } from '../../../../shared/types/index';
import { formatValue } from '../../../../shared/utils/utils';
import {
  askResultToCsv,
  buildAskResultChartConfig,
  formatAskResultCell,
  importanceBadgeLabel,
  isRenderableAskChartType,
  resolveAskResultMetric,
} from './ask-result-model';

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
    if (!result || !isRenderableAskChartType(result.chartType)) return;
    const canvas = this.querySelector<HTMLCanvasElement>('#ask-data-chart');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const config = buildAskResultChartConfig(result);
    if (config) this._chart = new Chart(ctx, config);
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

  private _renderTable(result: AskSuccessResult): TemplateResult {
    const columns = result.columns || [];
    const metric = resolveAskResultMetric(result);
    return html`
      <div class="ask-table-wrap">
        <table>
          <thead>
            <tr>
              ${columns.map((col) => html`<th>${col}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${(result.rows || []).map(
              (row) => html`
                <tr>
                  ${columns.map(
                    (col) => html`<td>${formatAskResultCell(col, row[col], metric?.format)}</td>`,
                  )}
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  private _renderKpi(result: AskSuccessResult): TemplateResult {
    const value = result.rows[0]?.value;
    const metric = resolveAskResultMetric(result);
    return html`
      <div class="ask-kpi-value">${formatValue(value, metric?.format)}</div>
      ${this._renderTable(result)}
    `;
  }

  private _renderVisualization(result: AskSuccessResult): TemplateResult {
    if (result.chartType === 'kpi') return this._renderKpi(result);
    if (isRenderableAskChartType(result.chartType)) {
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
    if (!result.insights?.length && !result.narratives) return nothing;
    return html`
      <div class="interpretation">
        <strong>Insights:</strong>
        <ul style="margin:.45rem 0 0 1.1rem;padding:0;">
          ${result.insights.map((insight) => html`<li>${insight}</li>`)}
        </ul>
      </div>
    `;
  }

  private _importanceBadge(importance: number): TemplateResult | typeof nothing {
    const label = importanceBadgeLabel(importance);
    if (!label) return nothing;
    const tone = label.toLowerCase();
    return html`<span class="narrative-badge narrative-badge-${tone}">${label}</span>`;
  }

  private _renderNarratives(result: AskSuccessResult): TemplateResult | typeof nothing {
    const narratives = result.narratives;
    if (!narratives?.narratives?.length) return nothing;
    return html`
      <div class="narratives-section">
        <strong>AI Narrative Summary:</strong>
        <p class="narrative-summary">${narratives.summary}</p>
        <div class="narratives-list">
          ${narratives.narratives.map(
            (n) => html`
              <div class="narrative-item narrative-${n.type}" data-importance="${n.importance}">
                <div class="narrative-item-header">
                  <span class="narrative-type">${n.type}</span>
                  <span class="narrative-title">${n.title}</span>
                  ${this._importanceBadge(n.importance)}
                </div>
                <p class="narrative-text">${n.text}</p>
              </div>
            `,
          )}
        </div>
        ${narratives.keyTakeaway
          ? html`
              <div class="narrative-takeaway">
                <strong>Key Takeaway:</strong> ${narratives.keyTakeaway}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderExports(result: AskSuccessResult): TemplateResult {
    return html`
      <div class="interpretation" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
        <strong>Export:</strong>
        <ui-button
          .variant=${'choice'}
          .size=${'sm'}
          .content=${'Copy SQL'}
          @click=${() => this._copyText(result.sql)}
        ></ui-button>
        <ui-button
          .variant=${'choice'}
          .size=${'sm'}
          .content=${'Download CSV'}
          @click=${() => this._download('ask-result.csv', askResultToCsv(result), 'text/csv')}
        ></ui-button>
        <ui-button
          .variant=${'choice'}
          .size=${'sm'}
          .content=${'Download JSON'}
          @click=${() =>
            this._download(
              'ask-result.json',
              JSON.stringify(
                {
                  interpretation: result.interpretation,
                  sql: result.sql,
                  columns: result.columns,
                  rows: result.rows,
                },
                null,
                2,
              ),
              'application/json',
            )}
        ></ui-button>
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
              ${joinFanout.joinedCount?.toLocaleString?.() || joinFanout.joinedCount} joined rows
              (${joinFanout.ratio}x).
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
        <div class="interpretation"><strong>Interpreted as:</strong> ${result.interpretation}</div>
        ${(result.warnings || []).map((w) => html`<div class="warning">${w}</div>`)}
        ${this._renderInsights(result)} ${this._renderNarratives(result)}
        ${this._renderVisualization(result)} ${this._renderExports(result)}
        ${this._renderDecision(result)} ${this._renderDetails(result)}
      </section>
    `;
  }
}

if (!customElements.get('ask-result')) {
  customElements.define('ask-result', AskResult);
}
