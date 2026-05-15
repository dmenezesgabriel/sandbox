import '../../../../shared/ui/ui-button';
import '../../../../shared/ui/ui-text-field';

import { html, LitElement, type TemplateResult } from 'lit';
import { Sparkles } from 'lucide';

import { icon } from '../../../../shared/utils/icons';

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

  private _onInput(e: CustomEvent<string>): void {
    this.dispatchEvent(
      new CustomEvent<string>('question-change', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onEnterPress(): void {
    this._ask();
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
          <ui-text-field
            .accessibleLabel=${'Ask your data'}
            .value=${this.question}
            .appearance=${'prominent'}
            .placeholder=${'sales by region'}
            @value-change=${this._onInput}
            @enter-press=${this._onEnterPress}
          ></ui-text-field>
          <ui-button
            .variant=${'primary'}
            .size=${'lg'}
            .content=${this.loading
              ? html`<span class="ask-btn-spinner" aria-hidden="true"></span> Asking…`
              : html`${icon(Sparkles, { size: 16 })} Ask`}
            @click=${this._ask}
            ?disabled=${this.loading}
          ></ui-button>
        </div>
        <div aria-live="polite" aria-atomic="true" class="ask-sr-status">
          ${this.loading ? 'Processing your question…' : ''}
        </div>
        <div class="ask-examples">
          Try:
          ${this.examples.map(
            (example, i) =>
              html`${i ? ' · ' : ''}<ui-button
                  .variant=${'choice'}
                  .size=${'sm'}
                  .content=${example}
                  @click=${() => this._selectExample(example)}
                ></ui-button>`,
          )}
        </div>
      </section>
    `;
  }
}

if (!customElements.get('ask-input')) {
  customElements.define('ask-input', AskInput);
}
