import '../dashboard-canvas';
import '../question-picker';
import '../widget-editor';
import '../../../../shared/ui/ui-button';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { duckDBManager } from '../../../../infra/db/db';
import type {
  CellValue,
  Dashboard,
  DashboardConfig,
  DashboardFilterConfig,
  DataSourceConfig,
  Filters,
  QuestionConfig,
  WidgetConfig,
} from '../../../../shared/types/index';
import { escapeSqlString, quoteIdent, toRows } from '../../../../shared/utils/utils';
import { AskDataEngine } from '../../../ask/model/ask-data';
import { getDatasourceBySlug } from '../../../datasource/data/datasource-registry';
import { DASHBOARD_CONFIG } from '../../model/dashboard-config';
import {
  configToDashboard,
  dashboardToJson,
  dashboardToYaml,
  jsonToDashboard,
  yamlToDashboard,
} from '../../model/dashboard-yaml';
import { findBestPosition, migrateToGridLayout } from '../../model/grid-layout-engine';
import {
  applySqlFilters,
  exportFileBaseName,
  filterDashboardData,
  questionToWidget,
  sanitizePersistedDashboardLayouts,
  storageKeyForDashboard,
} from './dashboard-workspace-model';

type DashboardAskEventDetail = {
  dashboardId: string;
  widgetId: string;
  query: string;
};

type DashboardDataLoadedEventDetail = {
  dashboardId: string;
  source: 'cache' | 'query';
};

export class DashboardWorkspace extends LitElement {
  static override readonly properties = {
    config: { type: Object },
    isNew: { type: Boolean },
    slug: { type: String },
    sheets: { type: Array },
    activeSheetId: { type: String },
    editMode: { type: Boolean },
    selectedWidgetId: { type: String },
    sheetData: { state: true },
    widgetErrors: { state: true },
    filters: { type: Object },
    crossFilters: { state: true },
    _editingWidget: { state: true },
    _showEditor: { state: true },
    _showPicker: { state: true },
    _showOverflow: { state: true },
    _overflowMenuAlign: { state: true },
    _importError: { state: true },
  };

  config: DashboardConfig;
  isNew: boolean;
  slug: string;
  sheets: Dashboard[];
  activeSheetId: string | null;
  editMode: boolean;
  selectedWidgetId: string | null;
  sheetData: Record<
    string,
    { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
  >;
  widgetErrors: Record<string, string>;
  filters: Filters;
  crossFilters: Record<string, CellValue[]>;
  private _editingWidget: WidgetConfig | null = null;
  private _showEditor: boolean = false;
  private _showPicker: boolean = false;
  private _editorTrigger: HTMLElement | null = null;
  private _showOverflow = false;
  private _overflowMenuAlign: 'left' | 'right' = 'left';
  private _importError = '';
  private _askEngine: AskDataEngine;
  private _dataReady: boolean = false;
  private _dataCache: Record<
    string,
    Record<string, { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }>
  > = {};
  private _widgetErrorCache: Record<string, Record<string, string>> = {};
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
    this.config = DASHBOARD_CONFIG;
    this.slug = '';
    this.isNew = false;
    this.sheets = [];
    this.activeSheetId = null;
    this.editMode = false;
    this.selectedWidgetId = null;
    this.sheetData = {};
    this.widgetErrors = {};
    this.filters = {};
    this.crossFilters = {};
    this._askEngine = new AskDataEngine(this.config, duckDBManager);
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('config')) {
      this._askEngine = new AskDataEngine(this.config, duckDBManager);
      this._dataReady = false;
      this._dataCache = {};
      this._loadSheets();
      return;
    }

    if (changedProps.has('slug') || changedProps.has('isNew')) {
      this._loadSheets();
    }

    if (changedProps.has('editMode') && !this.editMode) {
      this.selectedWidgetId = null;
    }
  }

  private get _activeDashboard(): Dashboard | undefined {
    return this.sheets.find((dashboard) => dashboard.id === this.activeSheetId);
  }

  private get _resolvedDataSources(): DataSourceConfig[] {
    const slugs = this.config?.dataSourceSlugs ?? [];
    return slugs.map((s) => getDatasourceBySlug(s)).filter(Boolean) as DataSourceConfig[];
  }

  private async _ensureDataReady(): Promise<void> {
    if (this._dataReady) return;
    try {
      const sources = this._resolvedDataSources;
      for (const source of sources) {
        console.info(`[sheets] creating view ${source.name} from ${source.url}`);
        try {
          await duckDBManager.query(
            `CREATE OR REPLACE VIEW ${quoteIdent(source.name)} AS SELECT * FROM read_csv_auto('${escapeSqlString(
              source.url,
            )}')`,
          );
          console.info(`[sheets] created view ${source.name}`);
        } catch (err) {
          console.error(`[sheets] failed to create view ${source.name}:`, err);
          throw err;
        }
      }
      console.info('[sheets] initializing AskData engine');
      await this._askEngine.initialize();
      console.info('[sheets] AskData engine initialized');
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
    return this._activeDashboard?.filters ?? this.config.filters;
  }

  private async _executeSqlQuery(widget: WidgetConfig): Promise<{
    labels: string[];
    values: number[];
    rows?: Record<string, CellValue>[];
  }> {
    await this._ensureDataReady();
    const sql = applySqlFilters(widget.query ?? '', this._getFilterDefs(), this.filters);
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
    await this._ensureDataReady();
    this._emitAskEvent({
      dashboardId: this.activeSheetId ?? '',
      widgetId: widget.id,
      query: widget.query ?? '',
    });
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

  private _syncSheetData(): void {
    if (!this.activeSheetId) return;
    if (this._dataCache[this.activeSheetId]) {
      this.sheetData = { ...this._dataCache[this.activeSheetId] };
      this.widgetErrors = { ...(this._widgetErrorCache[this.activeSheetId] ?? {}) };
      this._emitSheetDataLoaded({ dashboardId: this.activeSheetId, source: 'cache' });
    } else {
      this._refreshWidgetData();
    }
  }

  private _onWidgetSelect(e: CustomEvent<{ id: string }>): void {
    this.selectedWidgetId = e.detail.id;
  }

  private _onWidgetDelete(e: CustomEvent<{ id: string }>): void {
    if (!this._activeDashboard) return;
    const idx = this._activeDashboard.widgets.findIndex((w) => w.id === e.detail.id);
    const widgets = this._activeDashboard.widgets.filter((w) => w.id !== e.detail.id);
    const layout = this._activeDashboard.layout.filter((_, i) => i !== idx);
    this._updateActiveSheet({ widgets, layout });
    this.selectedWidgetId = null;
    if (this.activeSheetId) {
      delete this._dataCache[this.activeSheetId];
    }
    this._persistSheets();
  }

  private _onAddWidget(): void {
    this._editorTrigger = document.activeElement as HTMLElement;
    this._editingWidget = null;
    this._showEditor = true;
  }

  private _onEditWidget(): void {
    if (!this._activeDashboard || !this.selectedWidgetId) return;
    const widget = this._activeDashboard.widgets.find((w) => w.id === this.selectedWidgetId);
    if (widget) {
      this._editorTrigger = document.activeElement as HTMLElement;
      this._editingWidget = widget;
      this._showEditor = true;
    }
  }

  private _onAttachQuestion(q: QuestionConfig): void {
    if (!this._activeDashboard) return;
    const widget = questionToWidget(q);
    const existingGridItems = migrateToGridLayout(
      this._activeDashboard.layout,
      this._activeDashboard.widgets.map((w) => w.id),
    );
    const pos = findBestPosition(widget.type, existingGridItems);
    this._updateActiveSheet({
      widgets: [...this._activeDashboard.widgets, widget],
      layout: [...this._activeDashboard.layout, { x: pos.x, y: pos.y, w: pos.w, h: pos.h }],
    });
    this._persistSheets();
    this._refreshWidgetData();
  }

  private _onWidgetSave(e: CustomEvent<{ widget: WidgetConfig; mode: 'add' | 'edit' }>): void {
    const { widget, mode } = e.detail;
    if (!this._activeDashboard) return;

    if (mode === 'add') {
      const existingGridItems = migrateToGridLayout(
        this._activeDashboard.layout,
        this._activeDashboard.widgets.map((w) => w.id),
      );
      const pos = findBestPosition(widget.type, existingGridItems);
      const layout = [...this._activeDashboard.layout, { x: pos.x, y: pos.y, w: pos.w, h: pos.h }];
      this._updateActiveSheet({
        widgets: [...this._activeDashboard.widgets, widget],
        layout,
      });
    } else {
      const widgets = this._activeDashboard.widgets.map((w) => (w.id === widget.id ? widget : w));
      this._updateActiveSheet({ widgets });
    }

    this._showEditor = false;
    this._editingWidget = null;
    const trigger = this._editorTrigger;
    this._editorTrigger = null;
    this.updateComplete.then(() => trigger?.focus());
    this._persistSheets();
    this._refreshWidgetData();
  }

  private _onEditorCancel(): void {
    this._showEditor = false;
    this._editingWidget = null;
    const trigger = this._editorTrigger;
    this._editorTrigger = null;
    this.updateComplete.then(() => trigger?.focus());
  }

  private _onLayoutChange(e: CustomEvent<{ sheet: Dashboard }>): void {
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

    const result = filterDashboardData(this.sheetData, this.crossFilters);

    this._cachedFilterResult = result;
    this._cachedFilterSheetData = this.sheetData;
    this._cachedFilterCrossFilters = this.crossFilters;
    return result;
  }

  private _updateActiveSheet(update: Partial<Dashboard>): void {
    this.sheets = this.sheets.map((s) =>
      s.id === this.activeSheetId ? { ...s, ...update, updatedAt: new Date().toISOString() } : s,
    );
  }

  // Public host-level hook for observing natural-language AskData executions.
  private _emitAskEvent(detail: DashboardAskEventDetail): void {
    this.dispatchEvent(new CustomEvent('dashboard-ask', { detail, bubbles: true, composed: true }));
  }

  // Public host-level hook for observing when the active dashboard data becomes ready.
  private _emitSheetDataLoaded(detail: DashboardDataLoadedEventDetail): void {
    this.dispatchEvent(
      new CustomEvent('dashboard-data-loaded', { detail, bubbles: true, composed: true }),
    );
  }

  private static readonly STORAGE_VERSION = 3;

  private _persistSheets(): void {
    const key = storageKeyForDashboard(this.slug);
    localStorage.setItem(
      key,
      JSON.stringify({ version: DashboardWorkspace.STORAGE_VERSION, data: this.sheets }),
    );
  }

  private _loadSheets(): void {
    try {
      if (this.isNew) {
        // For new dashboards, do not load shared persisted sheets — start blank.
        this._initDefaultSheet();
        return;
      }
      const oldKey = `sheets:${this.slug || 'default'}`;
      const key = storageKeyForDashboard(this.slug);
      if (!localStorage.getItem(key) && localStorage.getItem(oldKey)) {
        localStorage.setItem(key, localStorage.getItem(oldKey)!);
        localStorage.removeItem(oldKey);
      }
      const stored = localStorage.getItem(key);
      if (stored) {
        const raw = JSON.parse(stored);
        let parsed: Dashboard[];
        if (raw && raw.version === DashboardWorkspace.STORAGE_VERSION && Array.isArray(raw.data)) {
          parsed = raw.data as Dashboard[];
        } else {
          parsed = [];
        }
        if (parsed.length) {
          const [firstSheet] = sanitizePersistedDashboardLayouts(parsed);
          if (firstSheet) {
            this.sheets = [firstSheet];
            this.activeSheetId = firstSheet.id;
            this._loadWidgetData();
            return;
          }
        }
      }
    } catch {
      // ignore parse errors, fall through to default
    }

    this._initDefaultSheet();
  }

  private async _initDefaultSheet(): Promise<void> {
    const defaultSheet = configToDashboard(this.config);
    this.sheets = [defaultSheet];
    this.activeSheetId = defaultSheet.id;
    this._persistSheets();
    this._loadWidgetData();
  }

  private async _loadWidgetData(): Promise<void> {
    if (!this._activeDashboard) return;
    const loadingSheetId = this.activeSheetId;

    const newData: Record<
      string,
      { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }
    > = {};
    const newErrors: Record<string, string> = {};

    for (const widget of this._activeDashboard.widgets) {
      if (widget.query) {
        try {
          const result = await this._executeQuery(widget);
          newData[widget.id] = result;
        } catch (err) {
          console.error(`Failed to load data for widget ${widget.id}:`, err);
          newData[widget.id] = { labels: [], values: [] };
          newErrors[widget.id] = err instanceof Error ? err.message : String(err);
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
      this._widgetErrorCache[this.activeSheetId] = { ...newErrors };
    }
    this.sheetData = newData;
    this.widgetErrors = newErrors;
    if (loadingSheetId) {
      this._emitSheetDataLoaded({ dashboardId: loadingSheetId, source: 'query' });
    }
  }

  private async _refreshWidgetData(): Promise<void> {
    this.sheetData = {};
    this.widgetErrors = {};
    if (this.activeSheetId) {
      delete this._dataCache[this.activeSheetId];
      delete this._widgetErrorCache[this.activeSheetId];
    }
    await this._loadWidgetData();
  }

  private _onExportYaml(): void {
    if (!this._activeDashboard) return;
    const yaml = dashboardToYaml(this._activeDashboard);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileBaseName(this._activeDashboard.name)}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private _onExportJson(): void {
    if (!this._activeDashboard) return;
    const json = dashboardToJson(this._activeDashboard);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileBaseName(this._activeDashboard.name)}.json`;
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

  private _closeOverflow(): void {
    this._showOverflow = false;
  }

  private _toggleOverflow(e: MouseEvent): void {
    e.stopPropagation();
    if (!this._showOverflow) {
      const btn = e.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this._overflowMenuAlign = rect.right + 160 > window.innerWidth ? 'right' : 'left';
    }
    this._showOverflow = !this._showOverflow;
  }

  private readonly _onDocumentClick = (e: MouseEvent): void => {
    if (!this.contains(e.target as Node)) {
      this._closeOverflow();
    }
  };

  private readonly _onDocumentKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this._closeOverflow();
    }
  };

  private async _handleFileImport(): Promise<void> {
    const file = this._fileInput?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let sheet: Dashboard;

      if (file.name.endsWith('.json')) {
        sheet = jsonToDashboard(text);
      } else {
        sheet = yamlToDashboard(text);
      }

      this._importError = '';
      this.sheets = [sheet];
      this.activeSheetId = sheet.id;
      this.selectedWidgetId = null;
      this.crossFilters = {};
      this.sheetData = {};
      this.widgetErrors = {};
      this._dataCache = {};
      this._widgetErrorCache = {};
      this._persistSheets();
      this._refreshWidgetData();
    } catch (err) {
      console.error('Failed to import file:', err);
      this._importError = 'Failed to import file. Make sure it is valid YAML or JSON.';
    }
  }

  private _renderToolbar(dashboard: Dashboard | undefined): TemplateResult | typeof nothing {
    if (!this.editMode || !dashboard) return nothing;
    return html`
      <ui-button
        .variant=${'primary'}
        .size=${'sm'}
        .content=${'+ Add Question'}
        @click=${this._onAddWidget}
      ></ui-button>
      <ui-button
        .variant=${'secondary'}
        .size=${'sm'}
        .content=${'+ From library'}
        @click=${() => {
          this._showPicker = true;
        }}
      ></ui-button>
      ${this.selectedWidgetId
        ? html`
            <ui-button
              .variant=${'secondary'}
              .size=${'sm'}
              .content=${'Edit Question'}
              @click=${this._onEditWidget}
            ></ui-button>
          `
        : nothing}
    `;
  }

  private _renderEditor(): TemplateResult | typeof nothing {
    if (!this._showEditor) return nothing;
    return html`
      <widget-editor
        .widget=${this._editingWidget}
        .mode=${this._editingWidget ? 'edit' : 'add'}
        .dataSourceSlugs=${this.config?.dataSourceSlugs ?? []}
        @widget-save=${this._onWidgetSave}
        @editor-cancel=${this._onEditorCancel}
      ></widget-editor>
    `;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._onDocumentClick);
    document.addEventListener('keydown', this._onDocumentKeydown);
    this._loadSheets();
  }

  override disconnectedCallback(): void {
    document.removeEventListener('click', this._onDocumentClick);
    document.removeEventListener('keydown', this._onDocumentKeydown);
    super.disconnectedCallback();
    if (this._fileInput && this._fileInput.parentNode) {
      this._fileInput.parentNode.removeChild(this._fileInput);
      this._fileInput = null;
    }
  }

  private get _overflowMenuStyle(): string {
    return this._overflowMenuAlign === 'right' ? 'right: 0' : 'left: 0';
  }

  override render(): TemplateResult {
    const dashboard = this._activeDashboard;

    return html`
      <div class="dashboard-toolbar-bar">
        ${this._renderToolbar(dashboard)} ${dashboard ? html`` : nothing}
        <div class="toolbar-overflow-wrapper">
          <button
            class="toolbar-overflow-btn"
            aria-label="More actions"
            aria-expanded=${this._showOverflow}
            aria-haspopup="menu"
            @click=${this._toggleOverflow}
          >
            ⋯
          </button>

          ${this._showOverflow
            ? html`
                <div class="toolbar-overflow-menu" role="menu" style=${this._overflowMenuStyle}>
                  <button
                    role="menuitem"
                    @click=${() => {
                      this._onExportYaml();
                      this._closeOverflow();
                    }}
                  >
                    Export YAML
                  </button>
                  <button
                    role="menuitem"
                    @click=${() => {
                      this._onExportJson();
                      this._closeOverflow();
                    }}
                  >
                    Export JSON
                  </button>
                  <button
                    role="menuitem"
                    @click=${() => {
                      this._onImport();
                      this._closeOverflow();
                    }}
                  >
                    Import
                  </button>
                </div>
              `
            : nothing}
        </div>
        ${this._importError
          ? html`<div class="warning" role="alert">${this._importError}</div>`
          : nothing}
        ${Object.keys(this.crossFilters).length
          ? html`
              <div class="cross-filters">
                <span>Filters:</span>
                ${Object.entries(this.crossFilters).map(
                  ([field, values]) => html`
                    <span class="cross-filter-tag">
                      ${field}: ${values.join(', ')}
                      <button
                        aria-label="Remove ${field} filter"
                        @click=${() => this._onCrossFilterClear(field)}
                      >
                        ✕
                      </button>
                    </span>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>

      <dashboard-canvas
        .sheet=${dashboard ?? { id: '', name: '', type: 'layout', widgets: [], layout: [] }}
        .data=${this._getFilteredData()}
        .filters=${this.filters}
        .widgetErrors=${this.widgetErrors}
        .selectedWidgetId=${this.selectedWidgetId}
        .editMode=${this.editMode}
        @widget-select=${this._onWidgetSelect}
        @widget-delete=${this._onWidgetDelete}
        @layout-change=${this._onLayoutChange}
        @cross-filter=${this._onCrossFilterEvent}
      ></dashboard-canvas>

      ${this._renderEditor()}
      <question-picker
        .open=${this._showPicker}
        @question-attach=${(e: CustomEvent<QuestionConfig>) => this._onAttachQuestion(e.detail)}
        @picker-close=${() => {
          this._showPicker = false;
        }}
      ></question-picker>
    `;
  }
}

if (!customElements.get('dashboard-workspace')) {
  customElements.define('dashboard-workspace', DashboardWorkspace);
}
