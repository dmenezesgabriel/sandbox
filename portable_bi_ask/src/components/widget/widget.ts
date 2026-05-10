import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { Chart, registerables } from 'chart.js';
import type { WidgetConfig, CellValue, Filters } from '../../types';

Chart.register(...registerables);

export class Widget extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    data: { type: Object },
    filters: { type: Object },
    selected: { type: Boolean },
    editMode: { type: Boolean },
  };

  config: WidgetConfig;
  data: { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] } | null;
  filters: Filters;
  selected: boolean;
  editMode: boolean;
  private _chartInstance: Chart | null = null;

  constructor() {
    super();
    this.config = { id: '', type: 'text', title: 'Widget' };
    this.data = null;
    this.filters = {};
    this.selected = false;
    this.editMode = false;
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._destroyChart();
  }

  private _destroyChart(): void {
    if (this._chartInstance) {
      this._chartInstance.destroy();
      this._chartInstance = null;
    }
  }

  private _handleClick(e: MouseEvent): void {
    e.stopPropagation();
    if (!this.editMode) {
      console.log(`[widget] click on "${this.config.title}" — view mode, ignoring selection`);
      return;
    }
    console.log(`[widget] click on "${this.config.title}" — edit mode, selecting widget`);
    this.dispatchEvent(new CustomEvent('widget-select', {
      detail: { id: this.config.id },
      bubbles: true,
      composed: true,
    }));
  }

  private _onChartClick(element: { index: number }): void {
    if (!this.data?.labels) return;
    const label = this.data.labels[element.index];
    console.log(`[widget] chart click on "${this.config.title}" — cross-filter label="${label}"`);
    this.dispatchEvent(new CustomEvent('cross-filter', {
      detail: { widgetId: this.config.id, field: 'label', value: label },
      bubbles: true,
      composed: true,
    }));
  }

  private _onTableRowClick(e: Event, row: Record<string, CellValue>): void {
    e.stopPropagation();
    const label = String(row.label ?? row.name ?? '');
    console.log(`[widget] table row click on "${this.config.title}" — cross-filter label="${label}"`);
    this.dispatchEvent(new CustomEvent('cross-filter', {
      detail: { widgetId: this.config.id, field: 'label', value: label },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleDelete(e: MouseEvent): void {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('widget-delete', {
      detail: { id: this.config.id },
      bubbles: true,
      composed: true,
    }));
  }

  private _renderKpi(): TemplateResult {
    const kpi = this.config.kpiConfig;
    const value = this.data?.values?.[0] ?? this.data?.rows?.[0]?.value ?? 'N/A';
    const formatted = typeof kpi?.format === 'function' ? kpi.format(value) : String(value);
    return html`
      <div class="widget-kpi">
        <div class="kpi-label">${this.config.title}</div>
        <div class="kpi-value">${formatted}</div>
      </div>
    `;
  }

  private _renderChart(): TemplateResult {
    return html`<div class="widget-chart-container"><canvas></canvas></div>`;
  }

  private _renderTable(): TemplateResult {
    const rows = this.data?.rows ?? [];
    const cols = this.config.columns ?? ['Label', 'Value'];

    if (!rows.length) {
      return html`<div class="widget-empty">No data available</div>`;
    }

    return html`
      <div class="widget-table-wrap">
        <table class="widget-table">
          <thead>
            <tr>${cols.map(c => html`<th>${c}</th>`)}</tr>
          </thead>
          <tbody>
            ${rows.slice(0, 50).map(row => html`
              <tr class="clickable-row" @click=${(e: Event) => this._onTableRowClick(e, row)}>
                ${cols.map(c => html`<td>${this._formatCell(row[c])}</td>`)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  private _renderText(): TemplateResult {
    return html`<div class="widget-text">${this.config.textContent ?? ''}</div>`;
  }

  private _renderEmpty(): TemplateResult {
    return html`
      <div class="widget-empty">
        <div class="empty-icon">📊</div>
        <div>No data loaded</div>
        <div class="empty-hint">Add a query to display data</div>
      </div>
    `;
  }

  private _formatCell(v: CellValue): string {
    if (v == null) return '-';
    if (typeof v === 'number') {
      return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return String(v);
  }

  override firstUpdated(): void {
    this._initChart();
  }

  private _lastDataKey: string | null = null;

  override updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('data')) {
      const key = this.data ? `${this.data.labels.join(',')}|${this.data.values.join(',')}` : null;
      if (key !== this._lastDataKey) {
        console.log(`[widget] data changed for "${this.config.title}" — recreating chart`);
        this._destroyChart();
        this._initChart();
        this._lastDataKey = key;
      }
    }
  }

  private _initChart(): void {
    if (this.config.type !== 'chart' || !this.data) return;
    console.log(`[widget] initializing chart for "${this.config.title}"`);

    const canvas = this.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this._destroyChart();
    const chartType = this._getChartJsType();
    const colorSet = [
      '#c9613f', '#4a8c6f', '#2d6a8f', '#c8963e', '#8b6f9e',
      '#d9756a', '#6bb5a0', '#b89b6b', '#d48466', '#5a9e82',
    ];

    const isLineChart = chartType === 'line' || this.config.chartType === 'area';

    this._chartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels: this.data.labels,
        datasets: [{
          label: this.config.title,
          data: this.data.values,
          backgroundColor: isLineChart ? 'rgba(201, 97, 63, 0.1)' : colorSet,
          borderColor: '#c9613f',
          borderWidth: isLineChart ? 2 : 1,
          fill: this.config.chartType === 'area' || isLineChart,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        onClick: (_event: any, elements: any[]) => {
          if (elements.length > 0) {
            this._onChartClick({ index: elements[0].index });
          }
        },
      },
});
  }

  private _getChartJsType(): 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'bubble' {
    const map: Record<string, string> = {
      bar: 'bar', line: 'line', pie: 'pie',
      donut: 'doughnut', scatter: 'scatter', bubble: 'bubble', area: 'line',
    };
    return (map[this.config.chartType ?? 'bar'] ?? 'bar') as 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'bubble';
  }

  override render(): TemplateResult {
    const showContent = this.config.type === 'chart' ? !!this.data :
                        this.config.type === 'table' ? !!this.data?.rows?.length :
                        this.config.type === 'kpi' ? !!this.data :
                        true;

    return html`
      <div class="widget-header">
        <span class="widget-title">${this.config.title}</span>
        ${this.editMode ? html`
          <button class="widget-delete" @click=${this._handleDelete} title="Delete widget">✕</button>
        ` : nothing}
      </div>
      <div class="widget-content" @click=${this._handleClick}>
        ${this.config.type === 'kpi' ? this._renderKpi() :
          this.config.type === 'chart' ? (this.data ? this._renderChart() : this._renderEmpty()) :
          this.config.type === 'table' ? (this.data?.rows?.length ? this._renderTable() : this._renderEmpty()) :
          this._renderText()}
      </div>
    `;
  }
}

if (!customElements.get('app-widget')) {
  customElements.define('app-widget', Widget);
}