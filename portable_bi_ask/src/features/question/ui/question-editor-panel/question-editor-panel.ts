import '../../../dashboard/ui/widget';
import '../../../../shared/ui/code-editor';
import '../../../../shared/ui/datasource-picker/datasource-picker';
import '../../../../shared/ui/ui-button';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { DuckDBDataSourceManager } from '../../../../infra/data-sources/data-source-manager';
import { duckDBManager } from '../../../../infra/db/db';
import type {
  DataSourceConfig,
  QuestionConfig,
  WidgetConfig,
} from '../../../../shared/types/index';
import { SQL } from '../../../../shared/ui/code-editor';
import { AskDataEngine } from '../../../ask/model/ask-data';
import { getDatasourceBySlug } from '../../../datasource/data/datasource-registry';

const WIDGET_TYPES = ['chart', 'table', 'kpi', 'text'] as const;
const CHART_TYPES = [
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'bubble',
  'histogram',
] as const;

export class QuestionEditorPanel extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    titleError: { type: String },
    _previewData: { state: true },
    _previewError: { state: true },
    _previewLoading: { state: true },
    _pickerOpen: { state: true },
  };

  config: QuestionConfig | null = null;
  titleError = '';

  private _previewData: {
    labels: string[];
    values: number[];
    rows?: Record<string, unknown>[];
  } | null = null;
  private _previewError = '';
  private _previewLoading = false;
  private _pickerOpen = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _emit(changes: Partial<QuestionConfig>): void {
    if (!this.config) return;
    const updated: QuestionConfig = {
      ...this.config,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    this.dispatchEvent(
      new CustomEvent<QuestionConfig>('panel-change', {
        detail: updated,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get _resolvedDataSources(): DataSourceConfig[] {
    const slugs = this.config?.dataSourceSlugs ?? [];
    return slugs.map((s) => getDatasourceBySlug(s)).filter(Boolean) as DataSourceConfig[];
  }

  private get _missingDatasourceSlugs(): string[] {
    const slugs = this.config?.dataSourceSlugs ?? [];
    return slugs.filter((s) => !getDatasourceBySlug(s));
  }

  async runPreview(): Promise<void> {
    const isNl = this.config?.queryType === 'nl';
    const query = isNl ? (this.config?.nlQuery ?? this.config?.query) : this.config?.query;
    const sources = this._resolvedDataSources;
    if (!query || !sources.length) return;

    this._previewLoading = true;
    this._previewError = '';
    this._previewData = null;
    try {
      const dsm = new DuckDBDataSourceManager(duckDBManager);
      await dsm.createViews(sources);
      if (isNl) {
        const engine = new AskDataEngine({ dataSources: sources }, duckDBManager);
        await engine.initialize();
        const result = await engine.ask(query, {});
        if ('rows' in result && 'sql' in result) {
          this._emit({ query: result.sql });
          if (!result.rows.length) {
            this._previewError = 'Natural language query returned no results.';
          } else {
            const labels = result.rows.map((r) =>
              String(r.label ?? r.name ?? Object.values(r)[0] ?? ''),
            );
            const values = result.rows.map((r) =>
              Number(r.value ?? Object.values(r).find((v) => typeof v === 'number') ?? 0),
            );
            this._previewData = { labels, values, rows: result.rows };
          }
        } else {
          this._previewError = 'Natural language query returned no results.';
        }
      } else {
        const table = await duckDBManager.query(query);
        const rows = table
          .toArray()
          .map((r) => Object.fromEntries(table.schema.fields.map((f) => [f.name, r[f.name]])));
        const labels = rows.map((r) => String(r['label'] ?? r[Object.keys(r)[0]] ?? ''));
        const values = rows.map((r) => Number(r['value'] ?? r[Object.keys(r)[1]] ?? 0));
        this._previewData = { labels, values, rows };
      }
    } catch (err: unknown) {
      this._previewError = String(err);
    } finally {
      this._previewLoading = false;
    }
  }

  private _renderTypeSection(): TemplateResult {
    const q = this.config!;
    return html`
      <section class="qep-section">
        <label class="qep-label">Visualisation type</label>
        <div class="qep-type-grid">
          ${WIDGET_TYPES.map(
            (t) => html`
              <button
                class="qep-type-btn ${q.type === t ? 'active' : ''}"
                @click=${() => this._emit({ type: t })}
              >
                ${t}
              </button>
            `,
          )}
        </div>
        ${q.type === 'chart'
          ? html`
              <label class="qep-label qep-label-sm">Chart type</label>
              <select
                class="qep-select"
                .value=${q.chartType ?? 'bar'}
                @change=${(e: Event) =>
                  this._emit({
                    chartType: (e.target as HTMLSelectElement).value as QuestionConfig['chartType'],
                  })}
              >
                ${CHART_TYPES.map(
                  (ct) => html`<option value=${ct} ?selected=${q.chartType === ct}>${ct}</option>`,
                )}
              </select>
            `
          : nothing}
      </section>
    `;
  }

  private _renderQuerySection(): TemplateResult {
    const q = this.config!;
    return html`
      <section class="qep-section">
        <div class="qep-query-header">
          <label class="qep-label">Query</label>
          <div class="qep-query-type-toggle">
            <button
              class="qep-toggle-btn ${q.queryType !== 'nl' ? 'active' : ''}"
              @click=${() => this._emit({ queryType: 'sql' })}
            >
              SQL
            </button>
            <button
              class="qep-toggle-btn ${q.queryType === 'nl' ? 'active' : ''}"
              @click=${() => this._emit({ queryType: 'nl' })}
            >
              Natural language
            </button>
          </div>
        </div>
        ${q.queryType === 'nl'
          ? html`<textarea
              class="qep-query-input"
              rows="5"
              placeholder="e.g. sales by region"
              .value=${q.nlQuery ?? ''}
              @input=${(e: Event) =>
                this._emit({ nlQuery: (e.target as HTMLTextAreaElement).value })}
            ></textarea>`
          : html`<ui-code-editor
              .language=${SQL}
              .value=${q.query ?? ''}
              placeholder="SELECT ..."
              @value-change=${(e: CustomEvent<string>) => this._emit({ query: e.detail })}
            ></ui-code-editor>`}
        <button class="qep-run-btn" @click=${() => this.runPreview()}>Run preview</button>
      </section>
    `;
  }

  private _renderDataSourcesSection(): TemplateResult {
    const slugs = this.config?.dataSourceSlugs ?? [];
    const resolved = this._resolvedDataSources;
    const missing = this._missingDatasourceSlugs;

    return html`
      <section class="qep-section">
        <label class="qep-label">Linked datasources</label>
        ${slugs.length === 0
          ? html`<p class="qep-ds-empty">No datasources linked. Link one to run a preview.</p>`
          : html`
              <ul class="qep-ds-linked-list">
                ${resolved.map(
                  (ds) => html`
                    <li class="qep-ds-linked-item">
                      <span class="qep-ds-type-tag">${ds.type.toUpperCase()}</span>
                      <span class="qep-ds-name">${ds.name}</span>
                      <button
                        class="qep-ds-remove"
                        aria-label="Remove ${ds.name}"
                        title="Remove ${ds.name}"
                        @click=${() =>
                          this._emit({
                            dataSourceSlugs: slugs.filter((s) => s !== ds.slug),
                          })}
                      >
                        ✕
                      </button>
                    </li>
                  `,
                )}
                ${missing.map(
                  (s) => html`
                    <li class="qep-ds-linked-item qep-ds-missing">
                      <span class="qep-ds-warn">⚠ "${s}" not found</span>
                    </li>
                  `,
                )}
              </ul>
            `}

        <div class="qep-ds-actions">
          <ui-button
            .variant=${'secondary'}
            .size=${'sm'}
            .content=${'Manage datasources'}
            @click=${() => (this._pickerOpen = true)}
          ></ui-button>
          <a class="qep-ds-create-link" href="#/datasource/new" target="_self">
            + Create new datasource
          </a>
        </div>

        <datasource-picker
          .open=${this._pickerOpen}
          .selectedSlugs=${slugs}
          @datasources-selected=${(e: CustomEvent<string[]>) => {
            this._emit({ dataSourceSlugs: e.detail });
            this._pickerOpen = false;
          }}
          @picker-close=${() => (this._pickerOpen = false)}
        ></datasource-picker>
      </section>
    `;
  }

  private _renderPreview(): TemplateResult {
    if (!this.config) return html``;

    const sources = this._resolvedDataSources;
    if (!sources.length) {
      return html`
        <div class="qep-preview-placeholder">Link a datasource to enable live preview</div>
      `;
    }

    if (this._previewLoading) {
      return html`<div class="qep-preview-loading">Running query…</div>`;
    }

    if (this._previewError) {
      return html`<div class="qep-preview-error">${this._previewError}</div>`;
    }

    if (!this._previewData) {
      return html`<div class="qep-preview-placeholder">Click "Run preview" to see results</div>`;
    }

    const widgetConfig: WidgetConfig = {
      id: 'preview',
      type: this.config.type,
      title: this.config.title,
      chartType: this.config.chartType,
      columns: this.config.columns,
      columnFormats: this.config.columnFormats as Record<string, 'currency'> | undefined,
      options: this.config.options,
    };

    return html`
      <app-widget
        .config=${widgetConfig}
        .data=${this._previewData}
        .editMode=${false}
      ></app-widget>
    `;
  }

  override render(): TemplateResult {
    if (!this.config) return html``;

    return html`
      <div class="qep-layout">
        <div class="qep-form">
          <section class="qep-section">
            <label class="qep-label" for="qep-title">Title</label>
            <input
              id="qep-title"
              class="qep-input"
              type="text"
              .value=${this.config.title}
              ?aria-invalid=${!!this.titleError}
              @input=${(e: Event) => this._emit({ title: (e.target as HTMLInputElement).value })}
            />
            ${this.titleError
              ? html`<div role="alert" class="qep-field-error">${this.titleError}</div>`
              : nothing}
            <label class="qep-label qep-label-sm" for="qep-desc">Description (optional)</label>
            <input
              id="qep-desc"
              class="qep-input"
              type="text"
              placeholder="Short description"
              .value=${this.config.description ?? ''}
              @input=${(e: Event) =>
                this._emit({ description: (e.target as HTMLInputElement).value || undefined })}
            />
          </section>

          ${this._renderTypeSection()} ${this._renderQuerySection()}
          ${this._renderDataSourcesSection()}
        </div>

        <div class="qep-preview">
          <span class="qep-preview-label">Preview</span>
          ${this._renderPreview()}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('question-editor-panel')) {
  customElements.define('question-editor-panel', QuestionEditorPanel);
}
