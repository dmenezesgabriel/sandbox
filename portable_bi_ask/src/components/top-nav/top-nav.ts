import { html, LitElement, type TemplateResult } from 'lit';
import { ArrowLeft } from 'lucide';

import { icon } from '../../icons';

export type ActiveTab = 'dashboard' | 'askData';

export class TopNav extends LitElement {
  static override readonly properties = {
    activeTab: { type: String },
    brand: { type: String },
    subtitle: { type: String },
    showTabs: { type: Boolean },
    dashboardSlug: { type: String },
  };

  activeTab: ActiveTab = 'dashboard';
  brand = 'DataTalks';
  subtitle = '';
  showTabs = true;
  dashboardSlug = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _select(tab: ActiveTab): void {
    this.dispatchEvent(
      new CustomEvent<ActiveTab>('tab-change', { detail: tab, bubbles: true, composed: true }),
    );
  }

  private _goBack(): void {
    window.location.hash = '#/';
  }

  private _tabClass(tab: ActiveTab): string {
    return this.activeTab === tab ? 'topnav-tab-active' : '';
  }

  override render(): TemplateResult {
    const isInDashboard = !!this.dashboardSlug || this.showTabs;

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

          ${isInDashboard
            ? html`
                <div class="topnav-tabs" role="tablist" aria-label="Dashboard views">
                  <button
                    id="tab-dashboard"
                    class="topnav-tab ${this._tabClass('dashboard')}"
                    role="tab"
                    aria-selected=${this.activeTab === 'dashboard'}
                    aria-controls="panel-dashboard"
                    @click=${() => this._select('dashboard')}
                  >
                    <span class="topnav-tab-text">Editor</span>
                  </button>
                  <button
                    id="tab-ask-data"
                    class="topnav-tab ${this._tabClass('askData')}"
                    role="tab"
                    aria-selected=${this.activeTab === 'askData'}
                    aria-controls="panel-ask-data"
                    @click=${() => this._select('askData')}
                  >
                    <span class="topnav-tab-text">Ask Data</span>
                  </button>
                </div>
              `
            : ''}
        </div>
        <div class="topnav-glow" aria-hidden="true"></div>
      </nav>
    `;
  }
}

if (!customElements.get('top-nav')) {
  customElements.define('top-nav', TopNav);
}
