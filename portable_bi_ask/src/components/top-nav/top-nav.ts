import { html, LitElement, nothing, type TemplateResult } from 'lit';

export class TopNav extends LitElement {
  static override readonly properties = {
    brand: { type: String },
    subtitle: { type: String },
    activeSection: { type: String },
  };

  brand = 'DataTalks';
  subtitle = '';
  activeSection: 'dashboards' | 'questions' | 'datasources' | '' = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    const dashClass = `topnav-section-link${this.activeSection === 'dashboards' ? ' active' : ''}`;
    const dashCurrent = this.activeSection === 'dashboards' ? 'page' : nothing;
    const questClass = `topnav-section-link${this.activeSection === 'questions' ? ' active' : ''}`;
    const questCurrent = this.activeSection === 'questions' ? 'page' : nothing;
    const dsClass = `topnav-section-link${this.activeSection === 'datasources' ? ' active' : ''}`;
    const dsCurrent = this.activeSection === 'datasources' ? 'page' : nothing;

    return html`
      <nav class="topnav" aria-label="Main navigation">
        <div class="topnav-inner">
          <div class="topnav-brand">
            <span class="topnav-mark" aria-hidden="true"></span>
            <a class="topnav-wordmark" href="#/">DataTalks</a>
            ${this.subtitle ? html`<span class="topnav-subtitle">${this.subtitle}</span>` : ''}
          </div>

          <nav class="topnav-sections" aria-label="Sections">
            <a class="${dashClass}" href="#/" aria-current=${dashCurrent}> Dashboards </a>
            <a class="${questClass}" href="#/questions" aria-current=${questCurrent}> Questions </a>
            <a class="${dsClass}" href="#/datasources" aria-current=${dsCurrent}> Datasources </a>
          </nav>
        </div>
        <div class="topnav-glow" aria-hidden="true"></div>
      </nav>
    `;
  }
}

if (!customElements.get('top-nav')) {
  customElements.define('top-nav', TopNav);
}
