import '../ui-button';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

import type { Clarification, ClarificationChoice } from '../../types';

export class AskClarification extends LitElement {
  static override readonly properties = {
    clarification: { type: Object },
  };

  clarification: Clarification | null = null;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _choose(choice: ClarificationChoice): void {
    this.dispatchEvent(
      new CustomEvent<ClarificationChoice>('choice-select', {
        detail: choice,
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    if (!this.clarification) return nothing;
    return html`
      <section class="ask-card">
        <h3>Clarification needed</h3>
        <p>${this.clarification.message}</p>
        ${this.clarification.choices.map(
          (choice) => html`
            <ui-button
              .variant=${'choice'}
              .size=${'sm'}
              .content=${choice.label}
              @click=${() => this._choose(choice)}
            ></ui-button>
          `,
        )}
      </section>
    `;
  }
}

if (!customElements.get('ask-clarification')) {
  customElements.define('ask-clarification', AskClarification);
}
