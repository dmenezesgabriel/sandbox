import '../dashboard-list';
import '../dashboard-editor';
import '../top-nav';

import { html, LitElement, type TemplateResult } from 'lit';

import { getDashboardBySlug } from '../../dashboard-registry';

type Route = { view: 'list' } | { view: 'editor'; slug: string };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (!path || path === '/') return { view: 'list' };
  if (path.startsWith('dashboard/')) {
    const slug = path.replace('dashboard/', '');
    return { view: 'editor', slug };
  }
  return { view: 'list' };
}

function routeToHash(route: Route): string {
  if (route.view === 'list') return '#/';
  return `#/dashboard/${route.slug}`;
}

export class Dashboard extends LitElement {
  static override readonly properties = {
    _route: { state: true },
  };

  private _route: Route = { view: 'list' };

  constructor() {
    super();
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onHashChange(): void {
    this._route = parseHash(window.location.hash);
    this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._route = parseHash(window.location.hash);
    window.addEventListener('hashchange', this._onHashChange.bind(this));
  }

  override disconnectedCallback(): void {
    window.removeEventListener('hashchange', this._onHashChange.bind(this));
    super.disconnectedCallback();
  }

  private _navigate(route: Route): void {
    window.location.hash = routeToHash(route);
  }

  override render(): TemplateResult {
    if (this._route.view === 'editor') {
      const config = getDashboardBySlug(this._route.slug);
      if (!config) {
        return html`
          <div class="dashboard-not-found">
            <h2 class="dashboard-nf-heading">Dashboard not found</h2>
            <p class="dashboard-nf-text">The dashboard "${this._route.slug}" does not exist.</p>
            <button class="primary-button" @click=${() => this._navigate({ view: 'list' })}>
              ← Back to Dashboards
            </button>
          </div>
        `;
      }
      return html`
        <dashboard-editor
          .config=${config}
          .slug=${this._route.slug}
          @navigate=${(e: CustomEvent<Route>) => this._navigate(e.detail)}
        ></dashboard-editor>
      `;
    }

    return html`
      <top-nav .showTabs=${false}></top-nav>
      <dashboard-list
        @dashboard-select=${(e: CustomEvent<{ slug: string }>) => {
          this._navigate({ view: 'editor', slug: e.detail.slug });
        }}
      ></dashboard-list>
    `;
  }
}

if (!customElements.get('app-dashboard')) {
  customElements.define('app-dashboard', Dashboard);
}
