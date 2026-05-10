import { html, LitElement, type TemplateResult } from 'lit';

export type ActiveTab = 'dashboard' | 'askData' | 'sheets';

export class TabNav extends LitElement {
  static override readonly properties = {
    activeTab: { type: String },
  };

  activeTab: ActiveTab = 'dashboard';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _select(tab: ActiveTab): void {
    this.dispatchEvent(new CustomEvent<ActiveTab>('tab-change', { detail: tab, bubbles: true, composed: true }));
  }

  override render(): TemplateResult {
    return html`
      <nav class="tabs" aria-label="App sections">
        <button
          class="tab-button ${this.activeTab === 'dashboard' ? 'active' : ''}"
          @click=${() => this._select('dashboard')}
        >
          Dashboard
        </button>
        <button
          class="tab-button ${this.activeTab === 'askData' ? 'active' : ''}"
          @click=${() => this._select('askData')}
        >
          Ask Data
        </button>
        <button
          class="tab-button ${this.activeTab === 'sheets' ? 'active' : ''}"
          @click=${() => this._select('sheets')}
        >
          Sheets
        </button>
      </nav>
    `;
  }
}

if (!customElements.get('tab-nav')) {
  customElements.define('tab-nav', TabNav);
}