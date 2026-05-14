import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { ArrowLeft } from 'lucide';

import { icon } from '../../icons';

export class TopNav extends LitElement {
  static override readonly properties = {
    brand: { type: String },
    subtitle: { type: String },
    dashboardSlug: { type: String },
    activeSection: { type: String },
  };

  brand = 'DataTalks';
  subtitle = '';
  dashboardSlug = '';
  activeSection: 'dashboards' | 'questions' | '' = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _goBack(): void {
    window.location.hash = '#/';
  }

  override render(): TemplateResult {
    const isInDashboard = !!this.dashboardSlug;

    const dashClass = `topnav-section-link${this.activeSection === 'dashboards' ? ' active' : ''}`;
    const dashCurrent = this.activeSection === 'dashboards' ? 'page' : nothing;
    const questClass = `topnav-section-link${this.activeSection === 'questions' ? ' active' : ''}`;
    const questCurrent = this.activeSection === 'questions' ? 'page' : nothing;
    const sectionsNav = isInDashboard
      ? ''
      : html`
          <nav class="topnav-sections" aria-label="Sections">
            <a class="${dashClass}" href="#/" aria-current=${dashCurrent}> Dashboards </a>
            <a class="${questClass}" href="#/questions" aria-current=${questCurrent}> Questions </a>
          </nav>
        `;

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

          ${sectionsNav}
        </div>
        <div class="topnav-glow" aria-hidden="true"></div>
      </nav>
    `;
  }
}

if (!customElements.get('top-nav')) {
  customElements.define('top-nav', TopNav);
}
