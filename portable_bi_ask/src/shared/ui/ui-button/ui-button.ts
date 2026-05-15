import { html, LitElement, type TemplateResult } from 'lit';

export type UIButtonVariant = 'primary' | 'secondary' | 'choice';
export type UIButtonSize = 'sm' | 'md' | 'lg';

export class UIButton extends LitElement {
  static override readonly properties = {
    variant: { type: String },
    size: { type: String },
    disabled: { type: Boolean },
    type: { type: String },
    content: { attribute: false },
  };

  variant: UIButtonVariant = 'primary';
  size: UIButtonSize = 'md';
  disabled = false;
  type: 'button' | 'submit' | 'reset' = 'button';
  content: unknown = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    const classes = ['ui-button', `ui-button--${this.variant}`, `ui-button--${this.size}`].join(
      ' ',
    );
    return html`
      <button class=${classes} type=${this.type} ?disabled=${this.disabled}>${this.content}</button>
    `;
  }
}

if (!customElements.get('ui-button')) {
  customElements.define('ui-button', UIButton);
}
