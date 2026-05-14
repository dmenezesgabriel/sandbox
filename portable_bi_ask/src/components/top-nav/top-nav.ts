import { html, LitElement, type TemplateResult } from 'lit';
import { ArrowLeft } from 'lucide';

import { icon } from '../../icons';

export class TopNav extends LitElement {
  static override readonly properties = {
    brand: { type: String },
    subtitle: { type: String },
    dashboardSlug: { type: String },
  };

  brand = 'DataTalks';
  subtitle = '';
  dashboardSlug = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _goBack(): void {
    window.location.hash = '#/';
  }

  override render(): TemplateResult {
    const isInDashboard = !!this.dashboardSlug;

    return html`
      <nav class="topnav" aria-label="Main navigation">
        <div class="topnav-inner">
          <div class="topnav-brand">
            <span class="topnav-mark" aria-hidden="true"></span>
            ${isInDashboard
              ? html`
                  <button
                    class="topnav-back"
                    @click=${this._goBack}
                    aria-label="Back to Dashboards"
                    title="Back to Dashboards"
                  >
                    ${icon(ArrowLeft, { size: 18 })}
                  </button>
                `
              : ''}
            <a class="topnav-wordmark" href="#/">DataTalks</a>
            ${this.subtitle ? html`<span class="topnav-subtitle">${this.subtitle}</span>` : ''}
          </div>
        </div>
        <div class="topnav-glow" aria-hidden="true"></div>
      </nav>
    `;
  }
}

if (!customElements.get('top-nav')) {
  customElements.define('top-nav', TopNav);
}
