import { html, LitElement, type TemplateResult } from 'lit';

export class PageHeader extends LitElement {
  static override readonly properties = {
    title: { type: String },
    subtitle: { type: String },
  };

  override title = '';
  subtitle = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <header>
        <h1>${this.title}</h1>
        <span class="subtitle">${this.subtitle}</span>
      </header>
    `;
  }
}

if (!customElements.get('page-header')) {
  customElements.define('page-header', PageHeader);
}
