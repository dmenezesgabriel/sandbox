import { html, LitElement, nothing as renderNothing, type TemplateResult } from 'lit';
import type { Sheet, WidgetConfig, CellValue, Filters } from '../types';

import './widget';

const GRID_COLS = 12;
const ROW_HEIGHT = 40;

export class SheetCanvas extends LitElement {
  static override readonly properties = {
    sheet: { type: Object },
    data: { type: Object },
    filters: { type: Object },
    selectedWidgetId: { type: String },
    editMode: { type: Boolean },
    _dragState: { state: true },
    _resizeState: { state: true },
    _dragOffset: { state: true },
    _previewLayout: { state: true },
  };

  sheet: Sheet;
  data: Record<string, { labels: string[]; values: number[]; rows?: Record<string, CellValue>[] }>;
  filters: Filters;
  selectedWidgetId: string | null;
  editMode: boolean;
  private _dragState: { id: string; startX: number; startY: number; startLeft: number; startTop: number } | null = null;
  private _resizeState: { id: string; handle: string; startX: number; startY: number; startW: number; startH: number; startLeft: number; startTop: number } | null = null;
  private _dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private _previewLayout: { id: string; x: number; y: number; w: number; h: number } | null = null;
  private _boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private _boundMouseUp: (() => void) | null = null;
  private _rafId: number | null = null;

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

  private _getColWidth(): number {
    return this.getBoundingClientRect().width / GRID_COLS;
  }

  private _snapX(px: number): number {
    const colW = this._getColWidth();
    return Math.round(px / colW) * colW;
  }

  private _snapY(px: number): number {
    return Math.round(px / ROW_HEIGHT) * ROW_HEIGHT;
  }

  private _getWidgetPosition(index: number): { left: string; top: string; width: string; height: string } {
    const layout = this.sheet.layout?.[index];
    if (layout && layout.x !== undefined) {
      return {
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.w}px`,
        height: `${layout.h}px`,
      };
    }
    const cols = 4;
    const h = ROW_HEIGHT * 6;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cellW = 100 / cols;
    return {
      left: `${col * cellW}%`,
      top: `${row * (h + 8)}px`,
      width: `${cellW}%`,
      height: `${h}px`,
    };
  }

  private _getWidgetStyle(widget: WidgetConfig): string {
    if (this._previewLayout && this._previewLayout.id === widget.id) {
      return `position: absolute; left: ${this._previewLayout.x}px; top: ${this._previewLayout.y}px; width: ${this._previewLayout.w}px; height: ${this._previewLayout.h}px;`;
    }
    const idx = this.sheet.widgets.findIndex(w => w.id === widget.id);
    const pos = this._getWidgetPosition(idx);
    return `position: absolute; left: ${pos.left}; top: ${pos.top}; width: ${pos.width}; height: ${pos.height};`;
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
      const top = `${i * ROW_HEIGHT}px`;
      lines.push(html`<div class="grid-line grid-line-h" style="top: ${top}"></div>`);
    }

    return html`<div class="grid-overlay">${lines}</div>`;
  }

  private _onWidgetSelect(e: Event): void {
    const widget = (e.target as HTMLElement).closest('app-widget');
    if (!widget) return;
    const shadowRoot = widget.shadowRoot;
    const id = shadowRoot?.querySelector('.widget')?.getAttribute('data-widget-id') ?? (widget as any).config?.id;
    this.selectedWidgetId = id;
    this.dispatchEvent(new CustomEvent('widget-select', { detail: { id }, bubbles: true, composed: true }));
  }

  private _onWidgetDelete(e: Event): void {
    const widget = (e.target as HTMLElement).closest('app-widget');
    if (!widget) return;
    const shadowRoot = widget.shadowRoot;
    const id = shadowRoot?.querySelector('.widget')?.getAttribute('data-widget-id') ?? (widget as any).config?.id;
    this.dispatchEvent(new CustomEvent('widget-delete', { detail: { id }, bubbles: true, composed: true }));
  }

  private _onCrossFilter(e: CustomEvent<{ widgetId: string; field: string; value: CellValue }>): void {
    this.dispatchEvent(new CustomEvent('cross-filter', { detail: e.detail, bubbles: true, composed: true }));
  }

  private _onMouseDown(e: MouseEvent): void {
    if (!this.editMode) return;
    const target = e.target as HTMLElement;
    const handle = target.closest('.resize-handle');
    const widgetWrapper = target.closest('.widget-wrapper');

    if (!widgetWrapper) return;

    if (handle) {
      const id = widgetWrapper.getAttribute('data-widget-id')!;
      const rect = widgetWrapper.getBoundingClientRect();
      this._resizeState = {
        id,
        handle: handle.getAttribute('data-handle')!,
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height,
        startLeft: rect.left,
        startTop: rect.top,
      };
      e.preventDefault();
      e.stopPropagation();
    } else if (!target.closest('.widget-delete') && !target.closest('.widget-title')) {
      const id = widgetWrapper.getAttribute('data-widget-id')!;
      const wrapper = widgetWrapper as HTMLElement;
      this._dragState = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: parseFloat(wrapper.style.left) || wrapper.offsetLeft,
        startTop: parseFloat(wrapper.style.top) || wrapper.offsetTop,
      };
      this._dragOffset = { x: e.clientX - wrapper.offsetLeft, y: e.clientY - wrapper.offsetTop };
      wrapper.classList.add('dragging');
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private _scheduleUpdate(): void {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.requestUpdate();
    });
  }

  private _onMouseMove(e: MouseEvent): void {
    if (!this.editMode) return;

    if (this._dragState) {
      const widgetEl = this.querySelector(`[data-widget-id="${this._dragState.id}"]`) as HTMLElement;
      if (widgetEl) {
        const canvasRect = this.getBoundingClientRect();
        const newX = e.clientX - canvasRect.left - this._dragOffset.x;
        const newY = e.clientY - canvasRect.top - this._dragOffset.y;
        widgetEl.style.left = `${Math.max(0, newX)}px`;
        widgetEl.style.top = `${Math.max(0, newY)}px`;
        this._scheduleUpdate();
      }
    }

    if (this._resizeState) {
      const widgetEl = this.querySelector(`[data-widget-id="${this._resizeState.id}"]`) as HTMLElement;
      if (widgetEl) {
        const dx = e.clientX - this._resizeState.startX;
        const dy = e.clientY - this._resizeState.startY;
        const handle = this._resizeState.handle;
        const colW = this._getColWidth();

        let newW = this._resizeState.startW;
        let newH = this._resizeState.startH;
        let newX = this._resizeState.startLeft;
        let newY = this._resizeState.startTop;

        if (handle.includes('e')) {
          newW = Math.max(colW * 2, this._resizeState.startW + dx);
        }
        if (handle.includes('s')) {
          newH = Math.max(ROW_HEIGHT * 2, this._resizeState.startH + dy);
        }
        if (handle.includes('w')) {
          newW = Math.max(colW * 2, this._resizeState.startW - dx);
          newX = this._resizeState.startLeft + this._resizeState.startW - newW;
        }
        if (handle.includes('n')) {
          newH = Math.max(ROW_HEIGHT * 2, this._resizeState.startH - dy);
          newY = this._resizeState.startTop + this._resizeState.startH - newH;
        }

        widgetEl.style.left = `${newX - this.getBoundingClientRect().left}px`;
        widgetEl.style.top = `${newY - this.getBoundingClientRect().top}px`;
        widgetEl.style.width = `${newW}px`;
        widgetEl.style.height = `${newH}px`;
        this._scheduleUpdate();
      }
    }
  }

  private _onMouseUp(): void {
    if (this._dragState) {
      const widgetEl = this.querySelector(`[data-widget-id="${this._dragState.id}"]`) as HTMLElement;
      if (widgetEl) {
        widgetEl.classList.remove('dragging');
        const rawX = parseFloat(widgetEl.style.left) || 0;
        const rawY = parseFloat(widgetEl.style.top) || 0;
        const snappedX = this._snapX(rawX);
        const snappedY = this._snapY(rawY);
        widgetEl.style.left = `${snappedX}px`;
        widgetEl.style.top = `${snappedY}px`;
        this._updateLayout(this._dragState.id, {
          x: snappedX,
          y: snappedY,
          w: widgetEl.offsetWidth,
          h: widgetEl.offsetHeight,
        });
      }
    }

    if (this._resizeState) {
      const widgetEl = this.querySelector(`[data-widget-id="${this._resizeState.id}"]`) as HTMLElement;
      if (widgetEl) {
        const colW = this._getColWidth();
        const rawW = parseFloat(widgetEl.style.width) || this._resizeState.startW;
        const rawH = parseFloat(widgetEl.style.height) || this._resizeState.startH;
        const snappedW = Math.round(rawW / colW) * colW;
        const snappedH = this._snapY(rawH);
        widgetEl.style.width = `${snappedW}px`;
        widgetEl.style.height = `${snappedH}px`;
        this._updateLayout(this._resizeState.id, {
          w: snappedW,
          h: snappedH,
        });
      }
    }

    this._dragState = null;
    this._resizeState = null;
    this._previewLayout = null;
    this._emitLayoutChange();
  }

  private _updateLayout(id: string, update: { x?: number; y?: number; w?: number; h?: number }): void {
    const idx = this.sheet.widgets.findIndex(w => w.id === id);
    if (idx === -1) return;
    if (!this.sheet.layout[idx]) {
      this.sheet.layout[idx] = { x: 0, y: 0, w: 400, h: 300 };
    }
    const layout = this.sheet.layout[idx];
    if (update.x !== undefined) layout.x = update.x;
    if (update.y !== undefined) layout.y = update.y;
    if (update.w !== undefined) layout.w = update.w;
    if (update.h !== undefined) layout.h = update.h;
  }

  private _emitLayoutChange(): void {
    this.dispatchEvent(new CustomEvent('layout-change', {
      detail: { sheet: this.sheet },
      bubbles: true,
      composed: true,
    }));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    window.addEventListener('mousemove', this._boundMouseMove);
    window.addEventListener('mouseup', this._boundMouseUp);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
    }
    if (this._boundMouseMove) {
      window.removeEventListener('mousemove', this._boundMouseMove);
    }
    if (this._boundMouseUp) {
      window.removeEventListener('mouseup', this._boundMouseUp);
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="sheet-canvas ${this.editMode ? 'edit-mode' : ''}" @mousedown=${this._onMouseDown}>
        ${this._renderGridLines()}
        ${this.sheet.widgets.map((widget) => {
          const widgetData = this.data[widget.id];
          return html`
            <div
              class="widget-wrapper ${this.editMode ? 'edit-mode' : ''} ${this.selectedWidgetId === widget.id ? 'selected' : ''}"
              data-widget-id=${widget.id}
              style=${this._getWidgetStyle(widget)}
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
              ${this.editMode ? html`
                <div class="resize-handle resize-se" data-handle="se"></div>
                <div class="resize-handle resize-sw" data-handle="sw"></div>
                <div class="resize-handle resize-ne" data-handle="ne"></div>
                <div class="resize-handle resize-nw" data-handle="nw"></div>
              ` : renderNothing}
            </div>
          `;
        })}
        ${!this.sheet.widgets.length ? html`<div class="sheet-empty">Add widgets to this sheet</div>` : renderNothing}
      </div>
    `;
  }
}

if (!customElements.get('sheet-canvas')) {
  customElements.define('sheet-canvas', SheetCanvas);
}