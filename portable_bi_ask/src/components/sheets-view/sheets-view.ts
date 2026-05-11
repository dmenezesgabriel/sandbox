import '../sheets-manager';
import '../sheet-canvas';
import '../sheet-editor';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import { AskDataEngine } from '../../ask-data';
import { DASHBOARD_CONFIG } from '../../dashboard-config';
import { duckDBManager } from '../../db';
import type { CellValue, Filters, Sheet, WidgetConfig } from '../../types';

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
    const widgets = this._activeSheet.widgets.filter((w) => w.id !== e.detail.id);
    const layout = this._activeSheet.layout.filter(
      (_, i) => this._activeSheet!.widgets[i].id !== e.detail.id,
    );
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

  private _persistSheets(): void {
    localStorage.setItem('sheets', JSON.stringify(this.sheets));
  }

  private _loadSheets(): void {
    try {
      const stored = localStorage.getItem('sheets');
      if (stored) {
        this.sheets = JSON.parse(stored);
        this.activeSheetId = this.sheets[0]?.id ?? null;
        this._loadWidgetData();
      }
    } catch {
      this.sheets = [];
    }
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
          const result = await this._askEngine.ask(widget.query, {});
          if ('rows' in result && 'sql' in result) {
            const labels = result.rows.map((r) => String(r.label ?? r.name ?? ''));
            const values = result.rows.map((r) => Number(r.value ?? r.sales ?? r.count ?? 0));
            newData[widget.id] = { labels, values, rows: result.rows };
          }
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
        ${this._renderToolbar(sheet)}
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
