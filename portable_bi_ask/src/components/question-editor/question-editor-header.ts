import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { ArrowLeft } from 'lucide';

import { icon } from '../../icons';

export class QuestionEditorHeader extends LitElement {
  static override readonly properties = {
    title: { type: String },
    isNew: { type: Boolean },
    isDirty: { type: Boolean },
    isYaml: { type: Boolean },
  };

  override title = '';
  isNew = false;
  isDirty = false;
  isYaml = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    const saveBtnClass = `qeh-save-btn${this.isDirty ? ' dirty' : ''}`;
    const saveLabel = this.isNew ? 'Create' : 'Save';
    const deleteBtn = this.isNew
      ? nothing
      : html`
          <button
            class="qeh-delete-btn"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('question-delete', { bubbles: true, composed: true }),
              )}
          >
            Delete
          </button>
        `;
    const rightPanel = this.isYaml
      ? nothing
      : html`
          <div class="qeh-right">
            <button
              class="${saveBtnClass}"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('question-save', { bubbles: true, composed: true }),
                )}
            >
              ${saveLabel}
            </button>
            ${deleteBtn}
          </div>
        `;

    return html`
      <div class="qeh-header">
        <div class="qeh-left">
          <button
            class="qeh-back-btn"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('question-back', { bubbles: true, composed: true }),
              )}
            aria-label="Back to Questions"
          >
            ${icon(ArrowLeft, { size: 18 })} Questions
          </button>
          <h1 class="qeh-title">${this.title || 'Untitled Question'}</h1>
          ${this.isDirty
            ? html`<span class="qeh-dirty-dot" title="Unsaved changes"></span>`
            : nothing}
          ${this.isYaml ? html`<span class="qeh-badge">read-only</span>` : nothing}
        </div>

        ${rightPanel}
      </div>
    `;
  }
}

if (!customElements.get('question-editor-header')) {
  customElements.define('question-editor-header', QuestionEditorHeader);
}
