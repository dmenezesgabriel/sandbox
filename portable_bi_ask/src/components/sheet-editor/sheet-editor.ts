import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import type { ChartType2, WidgetConfig, WidgetType } from '../../types';

interface WidgetFormData {
  id: string;
  type: WidgetType;
  title: string;
  query: string;
  chartType: ChartType2;
  textContent: string;
}

export class SheetEditor extends LitElement {
  static override readonly properties = {
    widget: { type: Object },
    mode: { type: String },
    _form: { state: true },
    _activeSection: { state: true },
    _titleError: { state: true },
  };

  widget: WidgetConfig | null;
  mode: 'add' | 'edit';
  private _form: WidgetFormData;
  private _activeSection: 'general' | 'data' | 'style' = 'general';
  private _titleError = '';
  private _dialogRef = createRef<HTMLDialogElement>();

  constructor() {
    super();
    this.widget = null;
    this.mode = 'add';
    this._form = this._getDefaultForm();
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _getDefaultForm(): WidgetFormData {
    return {
      id: crypto.randomUUID(),
      type: 'chart',
      title: '',
      query: '',
      chartType: 'bar',
      textContent: '',
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.widget) {
      this._form = {
        id: this.widget.id,
        type: this.widget.type,
        title: this.widget.title,
        query: this.widget.query ?? '',
        chartType: this.widget.chartType ?? 'bar',
        textContent: this.widget.textContent ?? '',
      };
    } else {
      this._form = this._getDefaultForm();
    }
    this.updateComplete.then(() => this._dialogRef.value?.showModal());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    const dialog = this._dialogRef.value;
    if (dialog?.open) dialog.close();
  }

  private _updateForm(field: keyof WidgetFormData, value: string): void {
    (this._form as unknown as Record<string, string>)[field] = value;
    this.requestUpdate();
  }

  private _onSave(): void {
    if (!this._form.title.trim()) {
      this._titleError = 'Please enter a title for this question.';
      return;
    }
    this._titleError = '';
    const widget: WidgetConfig = {
      id: this._form.id,
      type: this._form.type as WidgetType,
      title: this._form.title.trim(),
      query: this._form.query || undefined,
      chartType: this._form.chartType as ChartType2,
      textContent: this._form.type === 'text' ? this._form.textContent : undefined,
    };

    this.dispatchEvent(
      new CustomEvent('widget-save', {
        detail: { widget, mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    );
    this._dialogRef.value?.close('save');
  }

  private _onCancel(): void {
    this.dispatchEvent(new CustomEvent('editor-cancel', { bubbles: true, composed: true }));
    this._dialogRef.value?.close('cancel');
  }

  private _onDialogClose(): void {
    if (
      this._dialogRef.value?.returnValue !== 'save' &&
      this._dialogRef.value?.returnValue !== 'cancel'
    ) {
      this.dispatchEvent(new CustomEvent('editor-cancel', { bubbles: true, composed: true }));
    }
  }

  private _renderChartTypeSelect(): TemplateResult | typeof nothing {
    if (this._form.type !== 'chart') return nothing;
    return html`
      <div class="form-group">
        <label for="widget-chart-type">Chart Type</label>
        <select
          id="widget-chart-type"
          @change=${(e: Event) =>
            this._updateForm('chartType', (e.target as HTMLSelectElement).value)}
        >
          <option value="bar" ?selected=${this._form.chartType === 'bar'}>Bar</option>
          <option value="line" ?selected=${this._form.chartType === 'line'}>Line</option>
          <option value="area" ?selected=${this._form.chartType === 'area'}>Area</option>
          <option value="pie" ?selected=${this._form.chartType === 'pie'}>Pie</option>
          <option value="donut" ?selected=${this._form.chartType === 'donut'}>Donut</option>
          <option value="scatter" ?selected=${this._form.chartType === 'scatter'}>Scatter</option>
        </select>
      </div>
    `;
  }

  private _renderTextContent(): TemplateResult | typeof nothing {
    if (this._form.type !== 'text') return nothing;
    return html`
      <div class="form-group">
        <label for="widget-text-content">Content</label>
        <textarea
          id="widget-text-content"
          .value=${this._form.textContent}
          @input=${(e: Event) =>
            this._updateForm('textContent', (e.target as HTMLTextAreaElement).value)}
          placeholder="Enter text content..."
          rows="6"
        ></textarea>
      </div>
    `;
  }

  override render(): TemplateResult {
    const titleAriaDescribedBy = this._titleError ? 'title-error' : nothing;
    const titleAriaInvalid = this._titleError ? 'true' : nothing;
    const titleError = this._titleError
      ? html`<p id="title-error" class="field-error" role="alert">${this._titleError}</p>`
      : nothing;

    return html`
      <dialog
        class="sheet-editor"
        aria-labelledby="editor-heading"
        @close=${this._onDialogClose}
        ${ref(this._dialogRef)}
      >
        <div class="editor-header">
          <h3 id="editor-heading">${this.mode === 'add' ? 'Add Question' : 'Edit Question'}</h3>
        </div>

        <div class="editor-tabs">
          <button
            class="${this._activeSection === 'general' ? 'active' : ''}"
            @click=${() => {
              this._activeSection = 'general';
            }}
          >
            General
          </button>
          <button
            class="${this._activeSection === 'data' ? 'active' : ''}"
            @click=${() => {
              this._activeSection = 'data';
            }}
          >
            Data
          </button>
        </div>

        <div class="editor-body">
          ${this._activeSection === 'general'
            ? html`
                <div class="form-group">
                  <label for="widget-type">Question Type</label>
                  <select
                    id="widget-type"
                    @change=${(e: Event) =>
                      this._updateForm('type', (e.target as HTMLSelectElement).value)}
                  >
                    <option value="chart" ?selected=${this._form.type === 'chart'}>Chart</option>
                    <option value="table" ?selected=${this._form.type === 'table'}>Table</option>
                    <option value="kpi" ?selected=${this._form.type === 'kpi'}>KPI Card</option>
                    <option value="text" ?selected=${this._form.type === 'text'}>Text Box</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="widget-title">Title</label>
                  <input
                    id="widget-title"
                    type="text"
                    .value=${this._form.title}
                    @input=${(e: Event) => {
                      this._updateForm('title', (e.target as HTMLInputElement).value);
                      this._titleError = '';
                    }}
                    placeholder="Question title"
                    aria-describedby=${titleAriaDescribedBy}
                    aria-invalid=${titleAriaInvalid}
                  />
                  ${titleError}
                </div>

                ${this._renderChartTypeSelect()} ${this._renderTextContent()}
              `
            : nothing}
          ${this._activeSection === 'data'
            ? html`
                <div class="form-group">
                  <label for="widget-query">Query (Natural Language or SQL)</label>
                  <textarea
                    id="widget-query"
                    .value=${this._form.query}
                    @input=${(e: Event) =>
                      this._updateForm('query', (e.target as HTMLTextAreaElement).value)}
                    placeholder="e.g., sales by region or SELECT region, SUM(sales)..."
                    rows="4"
                  ></textarea>
                </div>
              `
            : nothing}
        </div>

        <div class="editor-actions">
          <button class="btn-cancel" @click=${this._onCancel}>Cancel</button>
          <button class="btn-save" @click=${this._onSave}>Save Question</button>
        </div>
      </dialog>
    `;
  }
}

if (!customElements.get('sheet-editor')) {
  customElements.define('sheet-editor', SheetEditor);
}
