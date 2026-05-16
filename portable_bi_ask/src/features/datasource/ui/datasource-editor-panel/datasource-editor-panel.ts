import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { duckDBManager } from '../../../../infra/db/db';
import type { DataSourceConfig, DataSourceType } from '../../../../shared/types/index';
import { escapeSqlString } from '../../../../shared/utils/utils';

const DS_TYPES: DataSourceType[] = ['csv', 'parquet', 'json'];

const READ_FN: Record<DataSourceType, string> = {
  csv: 'read_csv_auto',
  parquet: 'read_parquet',
  json: 'read_json_auto',
};

interface ColumnInfo {
  name: string;
  type: string;
}

export class DatasourceEditorPanel extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    readonly: { type: Boolean },
    nameError: { type: String },
    urlError: { type: String },
    _testStatus: { state: true },
    _testError: { state: true },
    _testColumns: { state: true },
    _testRows: { state: true },
    _testRowFields: { state: true },
    _testLoading: { state: true },
  };

  config: DataSourceConfig | null = null;
  readonly = false;
  nameError = '';
  urlError = '';

  private _testStatus: 'idle' | 'success' | 'error' = 'idle';
  private _testError = '';
  private _testColumns: ColumnInfo[] = [];
  private _testRows: Record<string, unknown>[] = [];
  private _testRowFields: string[] = [];
  private _testLoading = false;

  override connectedCallback(): void {
    super.connectedCallback();
    // Pre-warm DuckDB so the first Test Connection click is fast.
    duckDBManager.initialize().catch(() => {});
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _emit(changes: Partial<DataSourceConfig>): void {
    if (!this.config) return;
    const updated: DataSourceConfig = {
      ...this.config,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    this.dispatchEvent(
      new CustomEvent<DataSourceConfig>('panel-change', {
        detail: updated,
        bubbles: true,
        composed: true,
      }),
    );
  }

  async testConnection(): Promise<void> {
    if (!this.config?.url) return;
    this._testLoading = true;
    this._testStatus = 'idle';
    this._testError = '';
    this._testColumns = [];
    this._testRows = [];
    this._testRowFields = [];

    const fn = READ_FN[this.config.type ?? 'csv'];
    const url = escapeSqlString(this.config.url);

    try {
      // Schema via DESCRIBE
      const descResult = await duckDBManager.query(
        `DESCRIBE SELECT * FROM ${fn}('${url}') LIMIT 5`,
      );
      const descRows = descResult.toArray();
      this._testColumns = descRows.slice(0, 20).map((r) => ({
        name: String(r['column_name'] ?? r[0] ?? ''),
        type: String(r['column_type'] ?? r[1] ?? ''),
      }));

      // Data preview — 5 rows
      const dataResult = await duckDBManager.query(`SELECT * FROM ${fn}('${url}') LIMIT 5`);
      this._testRowFields = dataResult.schema.fields.map((f) => f.name);
      this._testRows = dataResult
        .toArray()
        .map((r) => Object.fromEntries(this._testRowFields.map((f) => [f, r[f]])));

      this._testStatus = 'success';
    } catch (err: unknown) {
      this._testStatus = 'error';
      this._testError = String(err);
    } finally {
      this._testLoading = false;
    }
  }

  private _renderDataPreview(): TemplateResult {
    if (!this._testRows.length) return html``;
    return html`
      <details class="ds-test-details" open>
        <summary class="ds-test-summary">Data preview (${this._testRows.length} rows)</summary>
        <div class="ds-preview-scroll">
          <table class="ds-schema-table ds-data-table">
            <thead>
              <tr>
                ${this._testRowFields.map((f) => html`<th>${f}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${this._testRows.map(
                (row) => html`
                  <tr>
                    ${this._testRowFields.map((f) => html`<td>${String(row[f] ?? '')}</td>`)}
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  private _renderConnectionTest(): TemplateResult {
    return html`
      <section class="qep-section">
        <label class="qep-label">Connection</label>
        <button
          class="qep-run-btn"
          ?disabled=${this._testLoading || !this.config?.url}
          @click=${() => this.testConnection()}
        >
          ${this._testLoading
            ? html`<span class="ds-test-spinner" aria-label="Testing…"></span> Testing…`
            : 'Test Connection'}
        </button>

        ${this._testStatus === 'success'
          ? html`
              <div class="ds-test-success">
                <p class="ds-test-ok">Connected — ${this._testColumns.length} columns detected</p>

                <details class="ds-test-details" open>
                  <summary class="ds-test-summary">
                    Schema (${this._testColumns.length} columns)
                  </summary>
                  <table class="ds-schema-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this._testColumns.map(
                        (col) => html`
                          <tr>
                            <td>${col.name}</td>
                            <td class="ds-schema-type">${col.type}</td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                </details>

                ${this._renderDataPreview()}
              </div>
            `
          : nothing}
        ${this._testStatus === 'error'
          ? html`<div class="qep-preview-error ds-test-error">${this._testError}</div>`
          : nothing}
      </section>
    `;
  }

  override render(): TemplateResult {
    if (!this.config) return html``;

    return html`
      <div class="qep-form">
        <section class="qep-section">
          <label class="qep-label" for="dse-name">Name</label>
          <input
            id="dse-name"
            class="qep-input"
            type="text"
            .value=${this.config.name}
            ?disabled=${this.readonly}
            ?aria-invalid=${!!this.nameError}
            @input=${(e: Event) => this._emit({ name: (e.target as HTMLInputElement).value })}
          />
          ${this.nameError
            ? html`<div role="alert" class="qep-field-error">${this.nameError}</div>`
            : nothing}

          <label class="qep-label qep-label-sm" for="dse-desc">Description (optional)</label>
          <input
            id="dse-desc"
            class="qep-input"
            type="text"
            placeholder="Short description"
            .value=${this.config.description ?? ''}
            ?disabled=${this.readonly}
            @input=${(e: Event) =>
              this._emit({ description: (e.target as HTMLInputElement).value || undefined })}
          />
        </section>

        <section class="qep-section">
          <label class="qep-label" for="dse-type">Source type</label>
          <select
            id="dse-type"
            class="qep-select"
            .value=${this.config.type}
            ?disabled=${this.readonly}
            @change=${(e: Event) =>
              this._emit({ type: (e.target as HTMLSelectElement).value as DataSourceType })}
          >
            ${DS_TYPES.map(
              (t) =>
                html`<option value=${t} ?selected=${this.config!.type === t}>
                  ${t.toUpperCase()}
                </option>`,
            )}
          </select>
        </section>

        <section class="qep-section">
          <label class="qep-label" for="dse-url">URL</label>
          <input
            id="dse-url"
            class="qep-input qep-input-url"
            type="url"
            placeholder="https://example.com/data.csv"
            .value=${this.config.url}
            ?disabled=${this.readonly}
            ?aria-invalid=${!!this.urlError}
            @input=${(e: Event) => this._emit({ url: (e.target as HTMLInputElement).value })}
          />
          ${this.urlError
            ? html`<div role="alert" class="qep-field-error">${this.urlError}</div>`
            : nothing}
        </section>

        ${this._renderConnectionTest()}
      </div>
    `;
  }
}

if (!customElements.get('datasource-editor-panel')) {
  customElements.define('datasource-editor-panel', DatasourceEditorPanel);
}
