import { html, LitElement, type TemplateResult } from 'lit';

export class AppSpinner extends LitElement {
  static override readonly properties = {
    label: { type: String },
    size: { type: String },
  };

  label = 'Loading\u2026';
  size: 'sm' | 'md' | 'lg' = 'md';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    const sizeClass = `spinner-${this.size || 'md'}`;
    return html`
      <div class="app-spinner ${sizeClass}">
        <div class="spinner-ring"></div>
        ${this.label ? html`<span class="spinner-label">${this.label}</span>` : ''}
      </div>
    `;
  }
}

if (!customElements.get('app-spinner')) {
  customElements.define('app-spinner', AppSpinner);
}
