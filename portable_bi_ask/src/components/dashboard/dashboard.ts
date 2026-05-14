import '../dashboard-list';
import '../dashboard-editor';
import '../top-nav';
import '../ui-button';
import '../question-list';
import '../question-editor';

import { html, LitElement, type TemplateResult } from 'lit';

import { createEmptyDashboardConfig } from '../../dashboard-config';
import { addDashboard, getDashboardBySlug } from '../../dashboard-registry';

type Route =
  | { view: 'list' }
  | { view: 'editor'; slug: string; isNew?: boolean }
  | { view: 'questions' }
  | { view: 'question-editor'; slug: string; isNew?: boolean };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (!path || path === '/') return { view: 'list' };

  if (path.startsWith('dashboard/')) {
    const rest = path.replace('dashboard/', '');
    if (rest === 'new') return { view: 'editor', slug: 'new', isNew: true };
    if (rest.startsWith('new/')) {
      const slug = rest.replace(/^new\//, '');
      return { view: 'editor', slug: slug || 'new', isNew: true };
    }
    return { view: 'editor', slug: rest };
  }

  if (path === 'questions') return { view: 'questions' };

  if (path.startsWith('question/')) {
    const rest = path.replace('question/', '');
    if (rest === 'new') return { view: 'question-editor', slug: 'new', isNew: true };
    if (rest.startsWith('new/')) {
      const slug = rest.replace(/^new\//, '');
      return { view: 'question-editor', slug: slug || 'new', isNew: true };
    }
    return { view: 'question-editor', slug: rest };
  }

  return { view: 'list' };
}

export function routeToHash(route: Route): string {
  if (route.view === 'list') return '#/';
  if (route.view === 'questions') return '#/questions';
  if (route.view === 'editor') {
    if (route.isNew) {
      return route.slug === 'new' ? '#/dashboard/new' : `#/dashboard/new/${route.slug}`;
    }
    return `#/dashboard/${route.slug}`;
  }
  if (route.view === 'question-editor') {
    if (route.isNew) {
      return route.slug === 'new' ? '#/question/new' : `#/question/new/${route.slug}`;
    }
    return `#/question/${route.slug}`;
  }
  return '#/';
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

  private _onDashboardCreate(e: CustomEvent<{ name: string }>): void {
    const cfg = createEmptyDashboardConfig(e.detail.name);
    const slug = addDashboard(cfg);
    this._navigate({ view: 'editor', slug, isNew: true });
  }

  override render(): TemplateResult {
    const r = this._route;

    if (r.view === 'questions') {
      return html`
        <top-nav .activeSection=${'questions'}></top-nav>
        <question-list
          @question-select=${(e: CustomEvent<string>) =>
            this._navigate({ view: 'question-editor', slug: e.detail })}
          @question-create=${(e: CustomEvent<string>) =>
            this._navigate({ view: 'question-editor', slug: e.detail, isNew: true })}
        ></question-list>
      `;
    }

    if (r.view === 'question-editor') {
      return html`
        <top-nav .activeSection=${'questions'} .dashboardSlug=${'_question_'}></top-nav>
        <question-editor .slug=${r.slug} .isNew=${r.isNew ?? false}></question-editor>
      `;
    }

    if (r.view === 'editor') {
      const { slug, isNew } = r;
      function slugToTitle(s: string) {
        if (!s) return 'New Dashboard';
        if (s === 'new') return 'New Dashboard';
        return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }

      const config = isNew
        ? createEmptyDashboardConfig(slugToTitle(slug))
        : getDashboardBySlug(slug);
      if (!config) {
        return html`
          <div class="dashboard-not-found">
            <h2 class="dashboard-nf-heading">Dashboard not found</h2>
            <p class="dashboard-nf-text">The dashboard "${slug}" does not exist.</p>
            <ui-button
              .variant=${'primary'}
              .size=${'lg'}
              .content=${'← Back to Dashboards'}
              @click=${() => this._navigate({ view: 'list' })}
            ></ui-button>
          </div>
        `;
      }
      return html`
        <dashboard-editor
          .config=${config}
          .slug=${slug}
          .isNew=${isNew ?? false}
          @navigate=${(e: CustomEvent<Route>) => this._navigate(e.detail)}
        ></dashboard-editor>
      `;
    }

    return html`
      <top-nav .activeSection=${'dashboards'}></top-nav>
      <dashboard-list
        @dashboard-select=${(e: CustomEvent<{ slug: string }>) => {
          this._navigate({ view: 'editor', slug: e.detail.slug });
        }}
        @dashboard-create=${(e: CustomEvent<{ name: string }>) => this._onDashboardCreate(e)}
      ></dashboard-list>
    `;
  }
}

if (!customElements.get('app-dashboard')) {
  customElements.define('app-dashboard', Dashboard);
}
