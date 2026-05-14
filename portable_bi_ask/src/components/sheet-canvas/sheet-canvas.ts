import '../widget';

import { html, LitElement, nothing as renderNothing, type TemplateResult } from 'lit';

import {
  COMPONENT_RULES,
  GAP_PX,
  GRID_COLS,
  type GridItemLayout,
  gridToPixels,
  migrateToGridLayout,
  normalizeLayout,
  resolveCollisions,
  ROW_PX,
} from '../../grid-layout-engine';
import type { CellValue, Filters, Sheet } from '../../types';

export class SheetCanvas extends LitElement {
  static override readonly properties = {
    sheet: { type: Object },
    data: { type: Object },
    filters: { type: Object },
    selectedWidgetId: { type: String },
    editMode: { type: Boolean },
    _workingLayout: { state: true },
    _draggingId: { state: true },
    _resizingId: { state: true },
    _containerWidth: { state: true },
  };

  sheet: Sheet;
  data: Record<string, { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }>;
  filters: Filters;
  selectedWidgetId: string | null;
  editMode: boolean;

  // Reactive state
  private _workingLayout: GridItemLayout[] | null = null;
  private _draggingId: string | null = null;
  private _resizingId: string | null = null;
  private _containerWidth: number = 1200;

  // Non-reactive private fields
  private _committedLayout: GridItemLayout[] = [];
  private _dragStartInfo: {
    id: string;
    pointerOffsetX: number;
    pointerOffsetY: number;
    startItem: GridItemLayout;
  } | null = null;
  private _resizeStartInfo: {
    id: string;
    handle: string;
    startPointerX: number;
    startPointerY: number;
    startItem: GridItemLayout;
    prevColSpan: number;
    prevRowSpan: number;
  } | null = null;
  private _dragPixelLeft: number = 0;
  private _dragPixelTop: number = 0;
  private _resizePixelW: number = 0;
  private _resizePixelH: number = 0;
  private _prevGridCell: { col: number; row: number } | null = null;
  private _latestPointer: { x: number; y: number } = { x: 0, y: 0 };
  private _frameRequested: boolean = false;

  private _resizeObserver: ResizeObserver | null = null;
  private _observedCanvas: HTMLElement | null = null;
  private _boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private _boundPointerUp: (() => void) | null = null;

  constructor() {
    super();
    this.sheet = { id: '', name: '', type: 'sheet', widgets: [], layout: [] };
    this.data = {};
    this.filters = {};
    this.selectedWidgetId = null;
    this.editMode = false;
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _getItemForWidget(widgetId: string): GridItemLayout | undefined {
    const layout = this._workingLayout ?? this._committedLayout;
    return (
      layout.find((i) => i.id === widgetId) ?? this._committedLayout.find((i) => i.id === widgetId)
    );
  }

  private _getWidgetStyle(widgetId: string): string {
    if (widgetId === this._draggingId) {
      const item = this._committedLayout.find((i) => i.id === widgetId);
      if (!item) return 'position: absolute;';
      const px = gridToPixels(item, this._containerWidth);
      return [
        'position: absolute;',
        `left: ${this._dragPixelLeft}px;`,
        `top: ${this._dragPixelTop}px;`,
        `width: ${px.width}px;`,
        `height: ${px.height}px;`,
        'z-index: 100;',
        'will-change: transform;',
      ].join(' ');
    }

    if (widgetId === this._resizingId) {
      const item = this._committedLayout.find((i) => i.id === widgetId);
      if (!item) return 'position: absolute;';
      const px = gridToPixels(item, this._containerWidth);
      return [
        'position: absolute;',
        `left: ${px.left}px;`,
        `top: ${px.top}px;`,
        `width: ${this._resizePixelW}px;`,
        `height: ${this._resizePixelH}px;`,
        'z-index: 100;',
      ].join(' ');
    }

    const item = this._getItemForWidget(widgetId);
    if (!item) return 'position: absolute;';
    const px = gridToPixels(item, this._containerWidth);
    return [
      'position: absolute;',
      `left: ${px.left}px;`,
      `top: ${px.top}px;`,
      `width: ${px.width}px;`,
      `height: ${px.height}px;`,
      'transition: left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease;',
    ].join(' ');
  }

  private _renderGridLines(): TemplateResult | typeof renderNothing {
    if (!this.editMode) return renderNothing;

    const lines: TemplateResult[] = [];
    const rows = 30;

    for (let i = 1; i < GRID_COLS; i++) {
      const left = `${(i / GRID_COLS) * 100}%`;
      lines.push(html`<div class="grid-line grid-line-v" style="left: ${left}"></div>`);
    }

    for (let i = 1; i < rows; i++) {
      const top = `${i * ROW_PX}px`;
      lines.push(html`<div class="grid-line grid-line-h" style="top: ${top}"></div>`);
    }

    return html`<div class="grid-overlay">${lines}</div>`;
  }

  private _onWidgetSelect(e: Event): void {
    if (!this.editMode) {
      console.log('[canvas] widget-select ignored — not in edit mode');
      return;
    }
    const widget = (e.target as HTMLElement).closest('app-widget');
    if (!widget) return;
    const shadowRoot = widget.shadowRoot;
    const id =
      shadowRoot?.querySelector('.widget')?.getAttribute('data-widget-id') ??
      (widget as unknown as { config?: { id?: string } }).config?.id ??
      null;
    console.log(`[canvas] widget selected: ${id}`);
    this.selectedWidgetId = id;
    this.dispatchEvent(
      new CustomEvent('widget-select', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  private _onWidgetDelete(e: Event): void {
    const widget = (e.target as HTMLElement).closest('app-widget');
    if (!widget) return;
    const shadowRoot = widget.shadowRoot;
    const id =
      shadowRoot?.querySelector('.widget')?.getAttribute('data-widget-id') ??
      (widget as unknown as { config?: { id?: string } }).config?.id;
    this.dispatchEvent(
      new CustomEvent('widget-delete', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  private _onCrossFilter(
    e: CustomEvent<{ widgetId: string; field: string; value: CellValue }>,
  ): void {
    this.dispatchEvent(
      new CustomEvent('cross-filter', { detail: e.detail, bubbles: true, composed: true }),
    );
  }

  private _getCanvasElement(): HTMLElement | null {
    return this.querySelector('.sheet-canvas');
  }

  private _getCanvasMetrics(): { width: number; left: number; top: number } {
    const canvasEl = this._getCanvasElement();
    const rect = canvasEl?.getBoundingClientRect() ?? this.getBoundingClientRect();
    const styles = canvasEl ? window.getComputedStyle(canvasEl) : null;
    const paddingLeft = styles ? Number.parseFloat(styles.paddingLeft) || 0 : 0;
    const paddingTop = styles ? Number.parseFloat(styles.paddingTop) || 0 : 0;
    const width = canvasEl?.clientWidth ?? this._containerWidth;
    return {
      width,
      left: rect.left + paddingLeft,
      top: rect.top + paddingTop,
    };
  }

  private _updateContainerWidth(): void {
    const canvasEl = this._getCanvasElement();
    const width = canvasEl?.clientWidth ?? 0;
    if (width > 0 && width !== this._containerWidth) {
      this._containerWidth = width;
    }
  }

  private _onPointerDown(e: PointerEvent): void {
    if (!this.editMode) return;
    const target = e.target as HTMLElement;
    const handle = target.closest('.resize-handle');
    const widgetWrapper = target.closest('.widget-wrapper') as HTMLElement | null;

    if (!widgetWrapper) return;

    const id = widgetWrapper.getAttribute('data-widget-id')!;
    const committedItem = this._committedLayout.find((i) => i.id === id);
    if (!committedItem) return;

    if (handle) {
      const px = gridToPixels(committedItem, this._containerWidth);
      this._resizePixelW = px.width;
      this._resizePixelH = px.height;
      this._resizeStartInfo = {
        id,
        handle: handle.getAttribute('data-handle')!,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startItem: { ...committedItem },
        prevColSpan: committedItem.w,
        prevRowSpan: committedItem.h,
      };
      this._resizingId = id;
      e.preventDefault();
      e.stopPropagation();
    } else if (!target.closest('.widget-delete') && !target.closest('.widget-title')) {
      const px = gridToPixels(committedItem, this._containerWidth);
      const wrapperRect = widgetWrapper.getBoundingClientRect();
      this._dragPixelLeft = px.left;
      this._dragPixelTop = px.top;
      this._dragStartInfo = {
        id,
        pointerOffsetX: e.clientX - wrapperRect.left,
        pointerOffsetY: e.clientY - wrapperRect.top,
        startItem: { ...committedItem },
      };
      this._draggingId = id;
      this._prevGridCell = null;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this._dragStartInfo && !this._resizeStartInfo) return;
    this._latestPointer = { x: e.clientX, y: e.clientY };
    if (!this._frameRequested) {
      this._frameRequested = true;
      requestAnimationFrame(() => this._processFrame());
    }
  }

  private _processFrame(): void {
    this._frameRequested = false;

    if (this._dragStartInfo) {
      const info = this._dragStartInfo;
      const { width: canvasWidth, left: canvasLeft, top: canvasTop } = this._getCanvasMetrics();
      const newLeft = Math.max(0, this._latestPointer.x - canvasLeft - info.pointerOffsetX);
      const newTop = Math.max(0, this._latestPointer.y - canvasTop - info.pointerOffsetY);
      this._dragPixelLeft = newLeft;
      this._dragPixelTop = newTop;

      // Apply to DOM directly without Lit rerender
      const draggedEl = this.querySelector(`[data-widget-id="${info.id}"]`) as HTMLElement | null;
      if (draggedEl) {
        draggedEl.style.left = `${newLeft}px`;
        draggedEl.style.top = `${newTop}px`;
      }

      // Calculate grid cell for preview using item center
      const committedItem = this._committedLayout.find((i) => i.id === info.id);
      if (committedItem) {
        const colW = canvasWidth / GRID_COLS;
        const rawCol = Math.round(newLeft / colW);
        const rawRow = Math.round(newTop / ROW_PX);
        const newCell = {
          col: Math.max(0, Math.min(GRID_COLS - 1, rawCol)),
          row: Math.max(0, rawRow),
        };

        const prevCell = this._prevGridCell;
        if (!prevCell || newCell.col !== prevCell.col || newCell.row !== prevCell.row) {
          this._prevGridCell = newCell;
          const colSpan = info.startItem.w;
          const candX = Math.max(0, Math.min(GRID_COLS - colSpan, newCell.col));
          const candY = Math.max(0, newCell.row);
          const updatedLayout = this._committedLayout.map((i) =>
            i.id === info.id ? { ...i, x: candX, y: candY } : i,
          );
          this._workingLayout = resolveCollisions(updatedLayout, info.id);
        }
      }
    }

    if (this._resizeStartInfo) {
      const info = this._resizeStartInfo;
      const dx = this._latestPointer.x - info.startPointerX;
      const dy = this._latestPointer.y - info.startPointerY;
      const colW = this._containerWidth / GRID_COLS;

      const widgetType = this.sheet.widgets.find((w) => w.id === info.id)?.type;
      const rules = widgetType ? COMPONENT_RULES[widgetType] : null;
      const minW = rules?.minW ?? 1;
      const minH = rules?.minH ?? 1;
      const maxW = rules?.maxW ?? GRID_COLS;
      const maxH = rules?.maxH ?? 100;

      const newColSpan = Math.max(
        minW,
        Math.min(maxW, Math.round((info.startItem.w * colW + dx) / colW)),
      );
      const newRowSpan = Math.max(
        minH,
        Math.min(maxH, Math.round((info.startItem.h * ROW_PX + dy) / ROW_PX)),
      );

      this._resizePixelW = newColSpan * colW - GAP_PX;
      this._resizePixelH = newRowSpan * ROW_PX - GAP_PX;

      // Apply to DOM directly
      const resizedEl = this.querySelector(`[data-widget-id="${info.id}"]`) as HTMLElement | null;
      if (resizedEl) {
        resizedEl.style.width = `${this._resizePixelW}px`;
        resizedEl.style.height = `${this._resizePixelH}px`;
      }

      // If span changed, update working layout
      if (newColSpan !== info.prevColSpan || newRowSpan !== info.prevRowSpan) {
        info.prevColSpan = newColSpan;
        info.prevRowSpan = newRowSpan;
        const updatedLayout = this._committedLayout.map((i) =>
          i.id === info.id ? { ...i, w: newColSpan, h: newRowSpan } : i,
        );
        this._workingLayout = resolveCollisions(updatedLayout, info.id);
      }
    }
  }

  private _onPointerUp(): void {
    if (this._dragStartInfo) {
      const finalLayout = normalizeLayout(this._workingLayout ?? this._committedLayout);
      this._committedLayout = finalLayout;
      this._workingLayout = null;
      this._draggingId = null;
      this._dragStartInfo = null;
      this._prevGridCell = null;
      this._emitLayoutChange();
    }

    if (this._resizeStartInfo) {
      const finalLayout = normalizeLayout(this._workingLayout ?? this._committedLayout);
      this._committedLayout = finalLayout;
      this._workingLayout = null;
      this._resizingId = null;
      this._resizeStartInfo = null;
      this._emitLayoutChange();
    }
  }

  private _emitLayoutChange(): void {
    const layout = this._committedLayout.map(({ x, y, w, h }) => ({ x, y, w, h }));
    const updatedSheet = { ...this.sheet, layout };
    this.dispatchEvent(
      new CustomEvent('layout-change', {
        detail: { sheet: updatedSheet },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _computeCanvasHeight(): number {
    const layout = this._workingLayout ?? this._committedLayout;
    const maxRow = layout.reduce((m, i) => Math.max(m, i.y + i.h), 0);
    return Math.max(400, maxRow * ROW_PX + 80);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp = this._onPointerUp.bind(this);
    window.addEventListener('pointermove', this._boundPointerMove);
    window.addEventListener('pointerup', this._boundPointerUp);
    this._resizeObserver = new ResizeObserver(() => this._updateContainerWidth());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._observedCanvas = null;
    if (this._boundPointerMove) {
      window.removeEventListener('pointermove', this._boundPointerMove);
    }
    if (this._boundPointerUp) {
      window.removeEventListener('pointerup', this._boundPointerUp);
    }
  }

  override updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('sheet')) {
      this._committedLayout = migrateToGridLayout(
        this.sheet.layout,
        this.sheet.widgets.map((w) => w.id),
        this._containerWidth || 1200,
      );
      this._workingLayout = null;
      this._draggingId = null;
      this._resizingId = null;
    }

    const canvasEl = this._getCanvasElement();
    if (canvasEl && canvasEl !== this._observedCanvas) {
      this._resizeObserver?.disconnect();
      this._resizeObserver?.observe(canvasEl);
      this._observedCanvas = canvasEl;
      this._updateContainerWidth();
    }
  }

  override render(): TemplateResult {
    const canvasHeight = this._computeCanvasHeight();

    // Ghost placeholder for drag target position
    let ghostTemplate: TemplateResult | typeof renderNothing = renderNothing;
    if (this._draggingId && this._workingLayout) {
      const ghostItem = this._workingLayout.find((i) => i.id === this._draggingId);
      if (ghostItem) {
        const px = gridToPixels(ghostItem, this._containerWidth);
        ghostTemplate = html`
          <div
            class="drag-ghost"
            style="left: ${px.left}px; top: ${px.top}px; width: ${px.width}px; height: ${px.height}px;"
          ></div>
        `;
      }
    }

    return html`
      <div
        class="sheet-canvas ${this.editMode ? 'edit-mode' : ''}"
        style="min-height: ${canvasHeight}px;"
        @pointerdown=${this._onPointerDown}
      >
        ${this._renderGridLines()} ${ghostTemplate}
        ${this.sheet.widgets.map((widget) => {
          const widgetData = this.data[widget.id];
          const isDragging = this._draggingId === widget.id;
          const isResizing = this._resizingId === widget.id;
          return html`
            <div
              class="widget-wrapper ${this.editMode ? 'edit-mode' : ''} ${this.selectedWidgetId ===
              widget.id
                ? 'selected'
                : ''} ${isDragging ? 'is-dragging' : ''} ${isResizing ? 'is-resizing' : ''}"
              data-widget-id=${widget.id}
              style=${this._getWidgetStyle(widget.id)}
            >
              <app-widget
                .config=${widget}
                .data=${widgetData ?? null}
                .filters=${this.filters}
                .selected=${this.selectedWidgetId === widget.id}
                .editMode=${this.editMode}
                @widget-select=${this._onWidgetSelect}
                @widget-delete=${this._onWidgetDelete}
                @cross-filter=${this._onCrossFilter}
              ></app-widget>
              ${this.editMode
                ? html`
                    <div class="resize-handle resize-se" data-handle="se"></div>
                    <div class="resize-handle resize-sw" data-handle="sw"></div>
                    <div class="resize-handle resize-ne" data-handle="ne"></div>
                    <div class="resize-handle resize-nw" data-handle="nw"></div>
                  `
                : renderNothing}
            </div>
          `;
        })}
        ${!this.sheet.widgets.length
          ? html`<div class="sheet-empty">Add questions to this dashboard</div>`
          : renderNothing}
      </div>
    `;
  }
}

if (!customElements.get('sheet-canvas')) {
  customElements.define('sheet-canvas', SheetCanvas);
}
