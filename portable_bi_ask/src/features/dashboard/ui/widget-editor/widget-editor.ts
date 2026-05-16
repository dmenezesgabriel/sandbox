import '../../../question/ui/question-editor-panel';
import '../../../../shared/ui/ui-button';

import { html, LitElement, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import type {
  ChartType2,
  QuestionConfig,
  WidgetConfig,
  WidgetType,
} from '../../../../shared/types/index';

function widgetToQuestionConfig(w: WidgetConfig): QuestionConfig {
  return {
    id: w.id,
    slug: w.id,
    title: w.title,
    type: w.type as WidgetType,
    chartType: w.chartType,
    query: w.query,
    queryType: w.queryType ?? 'sql',
    columns: w.columns,
    columnFormats: w.columnFormats,
    options: w.options,
    source: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function questionConfigToWidget(q: QuestionConfig, original: WidgetConfig): WidgetConfig {
  return {
    ...original,
    title: q.title,
    type: q.type,
    chartType: q.chartType as ChartType2 | undefined,
    query: q.query,
    queryType: q.queryType,
    columns: q.columns,
    columnFormats: q.columnFormats as Record<string, 'currency'> | undefined,
    options: q.options,
  };
}

export class WidgetEditor extends LitElement {
  static override readonly properties = {
    widget: { type: Object },
    mode: { type: String },
    dataSourceSlugs: { type: Array },
    _panelConfig: { state: true },
    _titleError: { state: true },
  };

  widget: WidgetConfig | null;
  mode: 'add' | 'edit';
  dataSourceSlugs: string[];
  private _panelConfig: QuestionConfig | null = null;
  private _titleError = '';
  private _dialogRef = createRef<HTMLDialogElement>();

  constructor() {
    super();
    this.widget = null;
    this.mode = 'add';
    this.dataSourceSlugs = [];
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _getDefaultPanelConfig(): QuestionConfig {
    const id = crypto.randomUUID();
    return {
      id,
      slug: id,
      title: '',
      type: 'chart',
      chartType: 'bar',
      queryType: 'sql',
      dataSourceSlugs: [...this.dataSourceSlugs],
      source: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._panelConfig = this.widget
      ? widgetToQuestionConfig(this.widget)
      : this._getDefaultPanelConfig();
    this.updateComplete.then(() => this._dialogRef.value?.showModal());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    const dialog = this._dialogRef.value;
    if (dialog?.open) dialog.close();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('widget')) {
      this._panelConfig = this.widget
        ? widgetToQuestionConfig(this.widget)
        : this._getDefaultPanelConfig();
    }
  }

  private _onSave(): void {
    if (!this._panelConfig) return;

    if (!this._panelConfig.title.trim()) {
      this._titleError = 'Please enter a title for this question.';
      return;
    }
    this._titleError = '';

    const widget: WidgetConfig = this.widget
      ? questionConfigToWidget(this._panelConfig, this.widget)
      : {
          id: this._panelConfig.id,
          type: this._panelConfig.type,
          title: this._panelConfig.title,
          query: this._panelConfig.query,
          queryType: this._panelConfig.queryType,
          chartType: this._panelConfig.chartType as ChartType2 | undefined,
          columns: this._panelConfig.columns,
          columnFormats: this._panelConfig.columnFormats as Record<string, 'currency'> | undefined,
          options: this._panelConfig.options,
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

  override render(): TemplateResult {
    return html`
      <dialog
        class="widget-editor"
        aria-labelledby="editor-heading"
        @close=${this._onDialogClose}
        ${ref(this._dialogRef)}
      >
        <div class="editor-header">
          <h3 id="editor-heading">${this.mode === 'add' ? 'Add Question' : 'Edit Question'}</h3>
        </div>

        <div class="editor-body">
          <question-editor-panel
            .config=${this._panelConfig}
            .titleError=${this._titleError}
            @panel-change=${(e: CustomEvent<QuestionConfig>) => {
              this._panelConfig = e.detail;
              if (e.detail.title.trim()) this._titleError = '';
            }}
          ></question-editor-panel>
        </div>

        <div class="editor-actions">
          <ui-button
            .variant=${'secondary'}
            .content=${'Cancel'}
            @click=${this._onCancel}
          ></ui-button>
          <ui-button
            .variant=${'primary'}
            .content=${'Save Question'}
            @click=${this._onSave}
          ></ui-button>
        </div>
      </dialog>
    `;
  }
}

if (!customElements.get('widget-editor')) {
  customElements.define('widget-editor', WidgetEditor);
}
