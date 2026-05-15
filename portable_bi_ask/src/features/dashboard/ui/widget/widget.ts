import '../../../../components/skeleton-loader';
import '../../../../components/spinner';

import { Chart, registerables } from 'chart.js';
import { html, LitElement, nothing, type TemplateResult } from 'lit';

import type { CellValue, Filters, ValueFormat, WidgetConfig } from '../../../../shared/types/index';
import { formatValue } from '../../../../shared/utils/utils';
import { buildWidgetChartConfig } from './widget-model';

Chart.register(...registerables);

export class Widget extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    data: { type: Object },
    filters: { type: Object },
    error: { type: String },
    selected: { type: Boolean },
    editMode: { type: Boolean },
  };

  config: WidgetConfig;
  data: { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] } | null;
  filters: Filters;
  error: string;
  selected: boolean;
  editMode: boolean;
  private _chartInstance: Chart | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _confirmingDelete = false;
  private _confirmTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.config = { id: '', type: 'text', title: 'Question' };
    this.data = null;
    this.filters = {};
    this.error = '';
    this.selected = false;
    this.editMode = false;
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._confirmTimeout) {
      clearTimeout(this._confirmTimeout);
      this._confirmTimeout = null;
    }
    this._destroyChart();
    this._resizeObserver?.disconnect();
  }

  private _destroyChart(): void {
    if (this._chartInstance) {
      this._chartInstance.destroy();
      this._chartInstance = null;
    }
  }

  private _formatValue(v: CellValue, format?: string): string {
    return formatValue(v, format as ValueFormat);
  }

  private _handleClick(_e: MouseEvent): void {
    if (!this.editMode) {
      console.log(`[widget] click on "${this.config.title}" — view mode, ignoring selection`);
      return;
    }
    console.log(`[widget] click on "${this.config.title}" — edit mode, selecting widget`);
    this.dispatchEvent(
      new CustomEvent('widget-select', {
        detail: { id: this.config.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onColorChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.config.backgroundColor = input.value || undefined;
    this.requestUpdate();
  }

  private _onChartClick(element: { index: number }): void {
    if (!this.data?.labels) return;
    const label = this.data.labels[element.index];
    console.log(`[widget] chart click on "${this.config.title}" — cross-filter label="${label}"`);
    this.dispatchEvent(
      new CustomEvent('cross-filter', {
        detail: { widgetId: this.config.id, field: 'label', value: label },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onTableRowClick(e: Event, row: Record<string, CellValue>): void {
    e.stopPropagation();
    const label = String(row.label ?? row.name ?? '');
    console.log(
      `[widget] table row click on "${this.config.title}" — cross-filter label="${label}"`,
    );
    this.dispatchEvent(
      new CustomEvent('cross-filter', {
        detail: { widgetId: this.config.id, field: 'label', value: label },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: MouseEvent): void {
    e.stopPropagation();

    if (!this._confirmingDelete) {
      this._confirmingDelete = true;
      this.requestUpdate();
      this._confirmTimeout = setTimeout(() => {
        this._confirmingDelete = false;
        this._confirmTimeout = null;
        this.requestUpdate();
      }, 3000);
      return;
    }

    if (this._confirmTimeout) {
      clearTimeout(this._confirmTimeout);
      this._confirmTimeout = null;
    }
    this._confirmingDelete = false;
    this.dispatchEvent(
      new CustomEvent('widget-delete', {
        detail: { id: this.config.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderKpi(): TemplateResult {
    const kpi = this.config.kpiConfig;
    if (!this.data) {
      return html`<skeleton-loader variant="kpi"></skeleton-loader>`;
    }
    const value = this.data.values?.[0] ?? this.data.rows?.[0]?.value ?? 'N/A';
    const formatted = this._formatValue(value, kpi?.format);
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
            <tr>
              ${cols.map((c) => html`<th>${c}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0, 50).map(
              (row) => html`
                <tr class="clickable-row" @click=${(e: Event) => this._onTableRowClick(e, row)}>
                  ${cols.map((c) => html`<td>${this._formatCell(row[c], c)}</td>`)}
                </tr>
              `,
            )}
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
        <div class="empty-icon" aria-hidden="true">📊</div>
        <div>No data loaded</div>
        <div class="empty-hint">Add a query to display data</div>
      </div>
    `;
  }

  private _renderError(): TemplateResult {
    return html`
      <div class="widget-error" role="alert">
        <div class="widget-error-icon" aria-hidden="true">⚠</div>
        <div class="widget-error-msg">${this.error}</div>
      </div>
    `;
  }

  private _formatCell(v: CellValue, col?: string): string {
    if (v == null) return '-';
    if (col && this.config.columnFormats?.[col]) {
      return this._formatValue(v, this.config.columnFormats[col]);
    }
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
    const chartConfig = buildWidgetChartConfig(this.config, {
      labels: this.data.labels,
      values: this.data.values,
    });

    this._chartInstance = new Chart(ctx, {
      ...chartConfig,
      options: {
        ...chartConfig.options,
        onClick: (_event: unknown, elements: { index: number }[]) => {
          if (elements.length > 0) {
            this._onChartClick({ index: elements[0].index });
          }
        },
      },
    });

    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      if (this._chartInstance) {
        this._chartInstance.resize();
      }
    });
    this._resizeObserver.observe(this);
    requestAnimationFrame(() => {
      this._chartInstance?.resize();
    });
  }

  override render(): TemplateResult {
    const bg = this.config.backgroundColor;
    const deleteClass = this._confirmingDelete ? 'widget-delete confirming' : 'widget-delete';
    const deleteAriaLabel = this._confirmingDelete
      ? `Confirm delete ${this.config.title}`
      : `Delete ${this.config.title}`;
    const deleteTitle = this._confirmingDelete
      ? 'Click again to confirm'
      : `Delete ${this.config.title}`;
    const deleteLabel = this._confirmingDelete ? 'Delete?' : '✕';

    return html`
      <div class="widget-header" style=${bg ? `background: ${bg};` : ''}>
        <span class="widget-title">${this.config.title}</span>
        ${this.editMode
          ? html`
              <label class="widget-color-picker" title="Background color">
                <input
                  type="color"
                  .value=${bg || '#ffffff'}
                  @input=${this._onColorChange}
                  @click=${(e: Event) => e.stopPropagation()}
                />
              </label>
              <button
                class=${deleteClass}
                @click=${this._handleDelete}
                aria-label=${deleteAriaLabel}
                title=${deleteTitle}
              >
                ${deleteLabel}
              </button>
            `
          : nothing}
      </div>
      <div
        class="widget-content"
        style=${bg ? `background: ${bg};` : ''}
        @click=${this._handleClick}
      >
        ${this._renderWidgetContent()}
      </div>
    `;
  }

  private _renderWidgetContent(): TemplateResult {
    if (this.error) return this._renderError();
    if (this.config.type === 'kpi') return this._renderKpi();
    if (this.config.type === 'chart') {
      if (this.data) return this._renderChart();
      return html`<app-spinner size="lg"></app-spinner>`;
    }
    if (this.config.type === 'table') {
      if (this.data?.rows?.length) return this._renderTable();
      if (!this.data) {
        return html`
          <skeleton-loader
            variant="table"
            .columns=${this.config.columns?.length || 3}
            .rows=${4}
          ></skeleton-loader>
        `;
      }
      return this._renderEmpty();
    }
    return this._renderText();
  }
}

if (!customElements.get('app-widget')) {
  customElements.define('app-widget', Widget);
}
