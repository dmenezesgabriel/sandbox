import { html, LitElement, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

export type UITextFieldAppearance = 'default' | 'prominent';

export class UITextField extends LitElement {
  static override readonly properties = {
    value: { type: String },
    placeholder: { type: String },
    type: { type: String },
    disabled: { type: Boolean },
    appearance: { type: String },
    inputId: { type: String, attribute: 'input-id' },
    accessibleLabel: { type: String },
    describedBy: { type: String },
    invalid: { type: String },
    autoFocus: { type: Boolean },
  };

  value = '';
  placeholder = '';
  type = 'text';
  disabled = false;
  appearance: UITextFieldAppearance = 'default';
  inputId?: string;
  accessibleLabel?: string;
  describedBy?: string;
  invalid?: 'true' | 'false';
  autoFocus = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.dispatchEvent(
      new CustomEvent<string>('value-change', {
        detail: value,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    this.dispatchEvent(new CustomEvent('enter-press', { bubbles: true, composed: true }));
  }

  override render(): TemplateResult {
    return html`
      <input
        class=${['ui-text-field', `ui-text-field--${this.appearance}`].join(' ')}
        id=${ifDefined(this.inputId)}
        type=${this.type}
        .value=${this.value}
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
        aria-label=${ifDefined(this.accessibleLabel)}
        aria-describedby=${ifDefined(this.describedBy)}
        aria-invalid=${ifDefined(this.invalid)}
        ?autofocus=${this.autoFocus}
        @input=${this._onInput}
        @keydown=${this._onKeydown}
      />
    `;
  }
}

if (!customElements.get('ui-text-field')) {
  customElements.define('ui-text-field', UITextField);
}
