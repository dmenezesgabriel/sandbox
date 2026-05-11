import { html, LitElement, type TemplateResult } from 'lit';

export type ActiveTab = 'dashboard' | 'askData';

export class TopNav extends LitElement {
  static override readonly properties = {
    activeTab: { type: String },
    brand: { type: String },
    subtitle: { type: String },
  };

  activeTab: ActiveTab = 'dashboard';
  brand = 'DataTalks';
  subtitle = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _select(tab: ActiveTab): void {
    this.dispatchEvent(
      new CustomEvent<ActiveTab>('tab-change', { detail: tab, bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    return html`
      <nav class="topnav" aria-label="Main navigation">
        <div class="topnav-inner">
          <div class="topnav-brand">
            <span class="topnav-mark" aria-hidden="true"></span>
            <span class="topnav-wordmark">DataTalks</span>
            ${this.subtitle ? html`<span class="topnav-subtitle">${this.subtitle}</span>` : ''}
          </div>

          <div class="topnav-tabs" role="tablist">
            <button
              class="topnav-tab ${this.activeTab === 'dashboard' ? 'topnav-tab-active' : ''}"
              role="tab"
              aria-selected=${this.activeTab === 'dashboard'}
              @click=${() => this._select('dashboard')}
            >
              <span class="topnav-tab-text">Editor</span>
            </button>
            <button
              class="topnav-tab ${this.activeTab === 'askData' ? 'topnav-tab-active' : ''}"
              role="tab"
              aria-selected=${this.activeTab === 'askData'}
              @click=${() => this._select('askData')}
            >
              <span class="topnav-tab-text">Ask Data</span>
            </button>
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
