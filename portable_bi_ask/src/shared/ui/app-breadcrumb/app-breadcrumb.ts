import { html, LitElement, type TemplateResult } from 'lit';

export type BreadcrumbItem = { label: string; href?: string };

export class AppBreadcrumb extends LitElement {
  static override readonly properties = {
    items: { type: Array },
  };

  items: BreadcrumbItem[] = [];

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <nav class="breadcrumb-nav" aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          ${this.items.map((item, i) => {
            const isLast = i === this.items.length - 1;
            const nonLastContent = item.href
              ? html`<a class="breadcrumb-link" href=${item.href}>${item.label}</a>`
              : html`<span class="breadcrumb-item-text">${item.label}</span>`;
            return html`
              <li class="breadcrumb-item">
                ${isLast
                  ? html`<span class="breadcrumb-current" aria-current="page">${item.label}</span>`
                  : nonLastContent}
              </li>
            `;
          })}
        </ol>
      </nav>
    `;
  }
}

if (!customElements.get('app-breadcrumb')) {
  customElements.define('app-breadcrumb', AppBreadcrumb);
}
