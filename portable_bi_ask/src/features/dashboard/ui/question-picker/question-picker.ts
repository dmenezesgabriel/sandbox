import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import type { QuestionConfig } from '../../../../shared/types/index';
import { questionList } from '../../../question/data/question-registry';

const TYPE_ICONS: Record<string, string> = {
  chart: '📊',
  table: '⊞',
  kpi: '◈',
  text: '¶',
};

export class QuestionPicker extends LitElement {
  static override readonly properties = {
    open: { type: Boolean },
    _filter: { state: true },
  };

  open = false;
  private _filter = '';
  private _dialogRef = createRef<HTMLDialogElement>();

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('open')) {
      if (this.open) {
        this._filter = '';
        try {
          this._dialogRef.value?.showModal();
        } catch (err) {
          console.error('[question-picker] showModal failed:', err);
        }
      } else {
        this._dialogRef.value?.close();
      }
    }
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onSelect(q: QuestionConfig): void {
    this.dispatchEvent(
      new CustomEvent<QuestionConfig>('question-attach', {
        detail: q,
        bubbles: true,
        composed: true,
      }),
    );
    this._close();
  }

  private _close(): void {
    this._dialogRef.value?.close();
  }

  private _onNativeClose(): void {
    this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
  }

  override render(): TemplateResult {
    const term = this._filter.toLowerCase();
    const questions = questionList().filter((q) => !term || q.title.toLowerCase().includes(term));

    return html`
      <dialog
        class="qpicker-modal"
        aria-labelledby="qpicker-title"
        @close=${this._onNativeClose}
        ${ref(this._dialogRef)}
      >
        <div class="qpicker-header">
          <span id="qpicker-title" class="qpicker-title">Add from library</span>
          <button class="qpicker-close" @click=${this._close} aria-label="Close">✕</button>
        </div>

        <div class="qpicker-search">
          <input
            class="qpicker-input"
            type="search"
            aria-label="Search questions"
            placeholder="Search questions…"
            .value=${this._filter}
            @input=${(e: Event) => {
              this._filter = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        <div class="qpicker-list">
          ${questions.length === 0
            ? html`<p class="qpicker-empty">No questions found.</p>`
            : questions.map(
                (q) => html`
                  <button class="qpicker-item" @click=${() => this._onSelect(q)}>
                    <span class="qpicker-item-icon">${TYPE_ICONS[q.type] ?? '?'}</span>
                    <span class="qpicker-item-body">
                      <span class="qpicker-item-title">${q.title}</span>
                      ${q.description
                        ? html`<span class="qpicker-item-desc">${q.description}</span>`
                        : nothing}
                    </span>
                    <span class="qpicker-item-type">${q.type}</span>
                  </button>
                `,
              )}
        </div>
      </dialog>
    `;
  }
}

if (!customElements.get('question-picker')) {
  customElements.define('question-picker', QuestionPicker);
}
