import { html, LitElement, type TemplateResult } from 'lit';
import { Sparkles } from 'lucide';

import { icon } from '../../icons';

export class AskInput extends LitElement {
  static override readonly properties = {
    question: { type: String },
    examples: { type: Array },
    loading: { type: Boolean },
  };

  question = '';
  examples: string[] = [];
  loading = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onInput(e: Event): void {
    const value = e.target instanceof HTMLInputElement ? e.target.value : '';
    this.dispatchEvent(
      new CustomEvent<string>('question-change', { detail: value, bubbles: true, composed: true }),
    );
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this._ask();
  }

  private _ask(): void {
    this.dispatchEvent(new CustomEvent('ask', { bubbles: true, composed: true }));
  }

  private _selectExample(example: string): void {
    this.dispatchEvent(
      new CustomEvent<string>('example-select', { detail: example, bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    return html`
      <section class="ask-card">
        <h2>Ask Data</h2>
        <div class="ask-input-row">
          <input
            aria-label="Ask your data"
            .value=${this.question}
            @input=${this._onInput}
            @keydown=${this._onKeydown}
            placeholder="sales by region"
          />
          <button class="primary-button" @click=${this._ask} ?disabled=${this.loading}>
            ${this.loading
              ? html`<span class="ask-btn-spinner" aria-hidden="true"></span> Asking…`
              : html`${icon(Sparkles, { size: 16 })} Ask`}
          </button>
        </div>
        <div aria-live="polite" aria-atomic="true" class="ask-sr-status">
          ${this.loading ? 'Processing your question…' : ''}
        </div>
        <div class="ask-examples">
          Try:
          ${this.examples.map(
            (example, i) =>
              html`${i ? ' · ' : ''}<button @click=${() => this._selectExample(example)}>
                  ${example}
                </button>`,
          )}
        </div>
      </section>
    `;
  }
}

if (!customElements.get('ask-input')) {
  customElements.define('ask-input', AskInput);
}
