import '../sheets-manager';
import '../sheet-canvas';
import '../sheet-editor';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { AskDataEngine } from '../../ask-data';
import { DASHBOARD_CONFIG } from '../../dashboard-config';
import { duckDBManager } from '../../db';
import {
  configToSheet,
  jsonToSheet,
  sheetToJson,
  sheetToYaml,
  yamlToSheet,
} from '../../sheet-yaml';
import type { CellValue, DashboardFilterConfig, Filters, Sheet, WidgetConfig } from '../../types';
import { escapeSqlString, quoteIdent, toRows } from '../../utils';

export class SheetsView extends LitElement {
  static override readonly properties = {
    sheets: { type: Array },
    activeSheetId: { type: String },
    editMode: { type: Boolean },
    selectedWidgetId: { type: String },
    sheetData: { state: true },
    filters: { type: Object },
    crossFilters: { state: true },
    _editingWidget: { state: true },
    _showEditor: { state: true },
  };

  sheets: Sheet[];
  activeSheetId: string | null;
  editMode: boolean;
  selectedWidgetId: string | null;
  sheetData: Record<
    string,
    { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
  >;
  filters: Filters;
  crossFilters: Record<string, CellValue[]>;
  private _editingWidget: WidgetConfig | null = null;
  private _showEditor: boolean = false;
  private readonly _askEngine: AskDataEngine;
  private _dataReady: boolean = false;
  private _dataCache: Record<
    string,
    Record<string, { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }>
  > = {};
  private _cachedFilterResult: Record<
    string,
    { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
  > | null = null;
  private _cachedFilterSheetData: Record<
    string,
    { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
  > | null = null;
  private _cachedFilterCrossFilters: Record<string, CellValue[]> | null = null;
  private _fileInput: HTMLInputElement | null = null;

  constructor() {
    super();
    this.sheets = [];
    this.activeSheetId = null;
    this.editMode = false;
    this.selectedWidgetId = null;
    this.sheetData = {};
    this.filters = {};
    this.crossFilters = {};
    this._askEngine = new AskDataEngine(DASHBOARD_CONFIG, duckDBManager);
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private get _activeSheet(): Sheet | undefined {
    return this.sheets.find((s) => s.id === this.activeSheetId);
  }

  private async _ensureDataReady(): Promise<void> {
    if (this._dataReady) return;
    try {
      for (const source of DASHBOARD_CONFIG.dataSources) {
        await duckDBManager.query(
          `CREATE OR REPLACE VIEW ${quoteIdent(source.name)} AS SELECT * FROM read_csv_auto('${escapeSqlString(source.url)}')`,
        );
      }
      await this._askEngine.initialize();
      this._dataReady = true;
    } catch (err) {
      console.error('[sheets] Failed to initialize data:', err);
      throw err;
    }
  }

  private _isSqlQuery(query: string): boolean {
    return /^\s*(SELECT|WITH)\b/i.test(query.trim());
  }

  private _getFilterDefs(): DashboardFilterConfig[] {
    return this._activeSheet?.filters ?? DASHBOARD_CONFIG.filters;
  }

  private async _executeSqlQuery(widget: WidgetConfig): Promise<{
    labels: string[];
    values: number[];
    rows?: Record<string, CellValue>[];
  }> {
    await this._ensureDataReady();
    let sql = widget.query ?? '';
    const filterDefs = this._getFilterDefs();
    for (const filterDef of filterDefs) {
      const placeholder = `--filter:${filterDef.field}--`;
      if (sql.includes(placeholder)) {
        const val = this.filters[filterDef.field];
        const replacement = val && val !== 'All' ? `'${String(val).replace(/'/g, "''")}'` : '1=1';
        sql = sql.replaceAll(placeholder, replacement);
      }
    }
    const result = await duckDBManager.query(sql);
    const rows = toRows(result).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]),
      ),
    );

    if (widget.type === 'kpi') {
      const vals = rows.map((r) =>
        Number(Object.values(r).find((v) => typeof v === 'number') ?? 0),
      );
      return { labels: [], values: vals, rows };
    }

    const labels = rows.map((r) => String(r.label ?? r.name ?? Object.values(r)[0] ?? ''));
    const values = rows.map((r) =>
      Number(r.value ?? Object.values(r).find((v) => typeof v === 'number') ?? 0),
    );
    return { labels, values, rows };
  }

  private async _executeAskQuery(widget: WidgetConfig): Promise<{
    labels: string[];
    values: number[];
    rows?: Record<string, CellValue>[];
  }> {
    const result = await this._askEngine.ask(widget.query, {});
    if ('rows' in result && 'sql' in result) {
      const labels = result.rows.map((r) => String(r.label ?? r.name ?? ''));
      const values = result.rows.map((r) => Number(r.value ?? r.sales ?? r.count ?? 0));
      return { labels, values, rows: result.rows };
    }
    return { labels: [], values: [] };
  }

  private async _executeQuery(widget: WidgetConfig): Promise<{
    labels: string[];
    values: number[];
    rows?: Record<string, CellValue>[];
  }> {
    if (!widget.query) return { labels: [], values: [] };

    const isSql = widget.queryType === 'sql' || this._isSqlQuery(widget.query);

    return isSql ? this._executeSqlQuery(widget) : this._executeAskQuery(widget);
  }

  private _onSheetSelect(e: CustomEvent<{ id: string }>): void {
    this.activeSheetId = e.detail.id;
    this.selectedWidgetId = null;
    this._syncSheetData();
  }

  private _syncSheetData(): void {
    if (!this.activeSheetId) return;
    if (this._dataCache[this.activeSheetId]) {
      this.sheetData = { ...this._dataCache[this.activeSheetId] };
    } else {
      this._refreshWidgetData();
    }
  }

  private _onSheetCreate(e: CustomEvent<{ name: string; type: 'sheet' | 'dashboard' }>): void {
    const newSheet: Sheet = {
      id: crypto.randomUUID(),
      name: e.detail.name,
      type: e.detail.type,
      widgets: [],
      layout: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sheets = [...this.sheets, newSheet];
    this.activeSheetId = newSheet.id;
    this.sheetData = {};
    this._persistSheets();
  }

  private _onSheetDelete(e: CustomEvent<{ id: string }>): void {
    delete this._dataCache[e.detail.id];
    this.sheets = this.sheets.filter((s) => s.id !== e.detail.id);
    if (this.activeSheetId === e.detail.id) {
      this.activeSheetId = this.sheets[0]?.id ?? null;
      this._syncSheetData();
    }
    this._persistSheets();
  }

  private _onSheetDuplicate(e: CustomEvent<{ sheet: Sheet }>): void {
    const copy: Sheet = {
      ...JSON.parse(JSON.stringify(e.detail.sheet)),
      id: crypto.randomUUID(),
      name: `${e.detail.sheet.name} (Copy)`,
      widgets: e.detail.sheet.widgets.map((w) => ({ ...w, id: crypto.randomUUID() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sheets = [...this.sheets, copy];
    this._persistSheets();
  }

  private _onEditModeToggle(e: CustomEvent<{ editMode: boolean }>): void {
    this.editMode = e.detail.editMode;
    if (!this.editMode) {
      this.selectedWidgetId = null;
    }
  }

  private _onWidgetSelect(e: CustomEvent<{ id: string }>): void {
    this.selectedWidgetId = e.detail.id;
  }

  private _onWidgetDelete(e: CustomEvent<{ id: string }>): void {
    if (!this._activeSheet) return;
    const idx = this._activeSheet.widgets.findIndex((w) => w.id === e.detail.id);
    const widgets = this._activeSheet.widgets.filter((w) => w.id !== e.detail.id);
    const layout = this._activeSheet.layout.filter((_, i) => i !== idx);
    this._updateActiveSheet({ widgets, layout });
    this.selectedWidgetId = null;
    if (this.activeSheetId) {
      delete this._dataCache[this.activeSheetId];
    }
    this._persistSheets();
  }

  private _onAddWidget(): void {
    this._editingWidget = null;
    this._showEditor = true;
  }

  private _onEditWidget(): void {
    if (!this._activeSheet || !this.selectedWidgetId) return;
    const widget = this._activeSheet.widgets.find((w) => w.id === this.selectedWidgetId);
    if (widget) {
      this._editingWidget = widget;
      this._showEditor = true;
    }
  }

  private _onWidgetSave(e: CustomEvent<{ widget: WidgetConfig; mode: 'add' | 'edit' }>): void {
    const { widget, mode } = e.detail;
    if (!this._activeSheet) return;

    if (mode === 'add') {
      const colWidth = 280;
      const rowHeight = 40;
      const layout = [
        ...this._activeSheet.layout,
        { x: 16, y: 16, w: colWidth * 3, h: rowHeight * 6 },
      ];
      this._updateActiveSheet({
        widgets: [...this._activeSheet.widgets, widget],
        layout,
      });
    } else {
      const widgets = this._activeSheet.widgets.map((w) => (w.id === widget.id ? widget : w));
      this._updateActiveSheet({ widgets });
    }

    this._showEditor = false;
    this._editingWidget = null;
    this._persistSheets();
    this._refreshWidgetData();
  }

  private _onEditorCancel(): void {
    this._showEditor = false;
    this._editingWidget = null;
  }

  private _onLayoutChange(e: CustomEvent<{ sheet: Sheet }>): void {
    const { sheet } = e.detail;
    this._updateActiveSheet({ layout: sheet.layout });
    this._persistSheets();
  }

  private _onCrossFilter(field: string, value: CellValue): void {
    const current = this.crossFilters[field] ?? [];
    const idx = current.indexOf(value as string);
    if (idx >= 0) {
      const updated = current.filter((_, i) => i !== idx);
      this.crossFilters = updated.length ? { [field]: updated } : {};
    } else {
      this.crossFilters = { ...this.crossFilters, [field]: [...current, value as string] };
    }
  }

  private _onCrossFilterClear(field: string): void {
    const rest: Record<string, CellValue[]> = {};
    for (const key of Object.keys(this.crossFilters)) {
      if (key !== field) rest[key] = this.crossFilters[key];
    }
    this.crossFilters = rest;
  }

  private _onCrossFilterEvent(
    e: CustomEvent<{ widgetId: string; field: string; value: CellValue }>,
  ): void {
    const { field, value } = e.detail;
    this._onCrossFilter(field, value);
  }

  private _getFilteredData(): Record<
    string,
    { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
  > {
    if (
      this._cachedFilterSheetData === this.sheetData &&
      this._cachedFilterCrossFilters === this.crossFilters
    ) {
      return this._cachedFilterResult!;
    }

    const result: Record<
      string,
      { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
    > = {};

    for (const [widgetId, data] of Object.entries(this.sheetData)) {
      let rows = data.rows ?? [];

      if (Object.keys(this.crossFilters).length) {
        const filterValues = Object.values(this.crossFilters).flat() as string[];

        if (filterValues.length) {
          rows = rows.filter((row) => {
            const label = (row.label ?? row.name) as string;
            return filterValues.includes(label);
          });
        }
      }

      const filteredValues = rows.map((r) => r.value as number);
      const filteredLabels = rows.map((r) => String(r.label ?? r.name ?? ''));

      result[widgetId] = {
        labels: filteredLabels,
        values: filteredValues,
        rows,
      };
    }

    this._cachedFilterResult = result;
    this._cachedFilterSheetData = this.sheetData;
    this._cachedFilterCrossFilters = this.crossFilters;
    return result;
  }

  private _updateActiveSheet(update: Partial<Sheet>): void {
    this.sheets = this.sheets.map((s) =>
      s.id === this.activeSheetId ? { ...s, ...update, updatedAt: new Date().toISOString() } : s,
    );
  }

  private static readonly STORAGE_KEY = 'sheets';
  private static readonly STORAGE_VERSION = 3;

  private _persistSheets(): void {
    localStorage.setItem(
      SheetsView.STORAGE_KEY,
      JSON.stringify({ version: SheetsView.STORAGE_VERSION, data: this.sheets }),
    );
  }

  private _loadSheets(): void {
    try {
      const stored = localStorage.getItem(SheetsView.STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored);
        let parsed: Sheet[];
        if (raw && raw.version === SheetsView.STORAGE_VERSION && Array.isArray(raw.data)) {
          parsed = raw.data as Sheet[];
        } else {
          parsed = [];
        }
        if (parsed.length) {
          this.sheets = parsed.map((s) => {
            const clean = { ...s } as Record<string, unknown>;
            delete clean.width;
            delete clean.height;
            return clean as unknown as Sheet;
          });
          this.activeSheetId = this.sheets[0]?.id ?? null;
          this._loadWidgetData();
          return;
        }
      }
    } catch {
      // ignore parse errors, fall through to default
    }

    this._initDefaultSheet();
  }

  private async _initDefaultSheet(): Promise<void> {
    const defaultSheet = configToSheet(DASHBOARD_CONFIG);
    this.sheets = [defaultSheet];
    this.activeSheetId = defaultSheet.id;
    this._persistSheets();
    this._loadWidgetData();
  }

  private async _loadWidgetData(): Promise<void> {
    if (!this._activeSheet) return;
    const loadingSheetId = this.activeSheetId;

    const newData: Record<
      string,
      { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
    > = {};

    for (const widget of this._activeSheet.widgets) {
      if (widget.query) {
        try {
          const result = await this._executeQuery(widget);
          newData[widget.id] = result;
        } catch (err) {
          console.error(`Failed to load data for widget ${widget.id}:`, err);
          newData[widget.id] = { labels: [], values: [] };
        }
      }
    }

    if (this.activeSheetId !== loadingSheetId) {
      console.log(
        `[sheets] data load stale (sheet changed), discarding results for "${loadingSheetId}"`,
      );
      return;
    }

    if (this.activeSheetId) {
      this._dataCache[this.activeSheetId] = { ...newData };
    }
    this.sheetData = newData;
  }

  private async _refreshWidgetData(): Promise<void> {
    this.sheetData = {};
    if (this.activeSheetId) {
      delete this._dataCache[this.activeSheetId];
    }
    await this._loadWidgetData();
  }

  private _onExportYaml(): void {
    if (!this._activeSheet) return;
    const yaml = sheetToYaml(this._activeSheet);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this._activeSheet.name.replace(/\s+/g, '-').toLowerCase()}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _onExportJson(): void {
    if (!this._activeSheet) return;
    const json = sheetToJson(this._activeSheet);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this._activeSheet.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _onImport(): void {
    if (!this._fileInput) {
      this._fileInput = document.createElement('input');
      this._fileInput.type = 'file';
      this._fileInput.accept = '.yaml,.yml,.json';
      this._fileInput.style.display = 'none';
      this._fileInput.addEventListener('change', () => this._handleFileImport());
      document.body.appendChild(this._fileInput);
    }
    this._fileInput.value = '';
    this._fileInput.click();
  }

  private async _handleFileImport(): Promise<void> {
    const file = this._fileInput?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let sheet: Sheet;

      if (file.name.endsWith('.json')) {
        sheet = jsonToSheet(text);
      } else {
        sheet = yamlToSheet(text);
      }

      this.sheets = [...this.sheets, sheet];
      this.activeSheetId = sheet.id;
      this.sheetData = {};
      this._persistSheets();
      this._refreshWidgetData();
    } catch (err) {
      console.error('Failed to import file:', err);
      alert('Failed to import file. Make sure it is valid YAML or JSON.');
    }
  }

  private _renderToolbar(sheet: Sheet | undefined): TemplateResult | typeof nothing {
    if (!this.editMode || !sheet) return nothing;
    return html`
      <button class="btn-add-widget" @click=${this._onAddWidget}>+ Add Widget</button>
      ${this.selectedWidgetId
        ? html` <button class="btn-edit-widget" @click=${this._onEditWidget}>Edit Widget</button> `
        : nothing}
    `;
  }

  private _renderEditor(): TemplateResult | typeof nothing {
    if (!this._showEditor) return nothing;
    return html`
      <sheet-editor
        .widget=${this._editingWidget}
        .mode=${this._editingWidget ? 'edit' : 'add'}
        @widget-save=${this._onWidgetSave}
        @editor-cancel=${this._onEditorCancel}
      ></sheet-editor>
    `;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadSheets();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._fileInput && this._fileInput.parentNode) {
      this._fileInput.parentNode.removeChild(this._fileInput);
      this._fileInput = null;
    }
  }

  override render(): TemplateResult {
    const sheet = this._activeSheet;

    return html`
      <sheets-manager
        .sheets=${this.sheets}
        .activeSheetId=${this.activeSheetId}
        .editMode=${this.editMode}
        @sheet-select=${this._onSheetSelect}
        @sheet-create=${this._onSheetCreate}
        @sheet-delete=${this._onSheetDelete}
        @sheet-duplicate=${this._onSheetDuplicate}
        @edit-mode-toggle=${this._onEditModeToggle}
      ></sheets-manager>

      <div class="sheets-toolbar-bar">
        ${this._renderToolbar(sheet)} ${sheet ? html`` : nothing}
        <button class="btn-export-yaml" @click=${this._onExportYaml} title="Export as YAML">
          Export YAML
        </button>
        <button class="btn-export-json" @click=${this._onExportJson} title="Export as JSON">
          Export JSON
        </button>
        <button class="btn-import" @click=${this._onImport} title="Import YAML/JSON">Import</button>
        ${Object.keys(this.crossFilters).length
          ? html`
              <div class="cross-filters">
                <span>Filters:</span>
                ${Object.entries(this.crossFilters).map(
                  ([field, values]) => html`
                    <span class="cross-filter-tag">
                      ${field}: ${values.join(', ')}
                      <button @click=${() => this._onCrossFilterClear(field)}>✕</button>
                    </span>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>

      <sheet-canvas
        .sheet=${sheet ?? { id: '', name: '', type: 'sheet', widgets: [], layout: [] }}
        .data=${this._getFilteredData()}
        .filters=${this.filters}
        .selectedWidgetId=${this.selectedWidgetId}
        .editMode=${this.editMode}
        @widget-select=${this._onWidgetSelect}
        @widget-delete=${this._onWidgetDelete}
        @layout-change=${this._onLayoutChange}
        @cross-filter=${this._onCrossFilterEvent}
      ></sheet-canvas>

      ${this._renderEditor()}
    `;
  }
}

if (!customElements.get('sheets-view')) {
  customElements.define('sheets-view', SheetsView);
}
