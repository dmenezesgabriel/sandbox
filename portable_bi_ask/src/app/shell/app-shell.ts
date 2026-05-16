import '../../features/question/ui/question-editor';
import '../../features/question/ui/question-list';
import '../../features/datasource/ui/datasource-list/datasource-list';
import '../../features/datasource/ui/datasource-editor/datasource-editor';
import '../../components/top-nav';
import '../../shared/ui/ui-button';
import '../../features/dashboard/ui/dashboard-editor';
import '../../features/dashboard/ui/dashboard-list';

import { html, LitElement, type TemplateResult } from 'lit';

import { addDashboard, getDashboardBySlug } from '../../features/dashboard/data/dashboard-registry';
import { createEmptyDashboardConfig } from '../../features/dashboard/model/dashboard-config';
import { addDatasource } from '../../features/datasource/data/datasource-registry';
import { addQuestion } from '../../features/question/data/question-registry';
import { createEmptyQuestionConfig } from '../../features/question/model/question-config';
import { parseHash, type Route, routeToHash } from '../routing/hash-routes';

export class AppShell extends LitElement {
  static override readonly properties = {
    _route: { state: true },
  };

  private _route: Route = { view: 'list' };

  private readonly _hashChangeHandler = (): void => {
    this._route = parseHash(window.location.hash);
    this.requestUpdate();
  };

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._route = parseHash(window.location.hash);
    window.addEventListener('hashchange', this._hashChangeHandler);
  }

  override disconnectedCallback(): void {
    window.removeEventListener('hashchange', this._hashChangeHandler);
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

  private _onQuestionCreate(e: CustomEvent<{ name: string }>): void {
    const q = addQuestion({
      ...createEmptyQuestionConfig(),
      title: e.detail.name,
    });
    this._navigate({ view: 'question-editor', slug: q.slug, isNew: true });
  }

  private _onDatasourceCreate(e: CustomEvent<{ name: string }>): void {
    const ds = addDatasource({ name: e.detail.name, type: 'csv', url: '' });
    this._navigate({ view: 'datasource-editor', slug: ds.slug, isNew: true });
  }

  override render(): TemplateResult {
    const r = this._route;

    if (r.view === 'questions') {
      return html`
        <top-nav .activeSection=${'questions'}></top-nav>
        <question-list
          @question-select=${(e: CustomEvent<{ slug: string }>) =>
            this._navigate({ view: 'question-editor', slug: e.detail.slug })}
          @question-create=${(e: CustomEvent<{ name: string }>) => this._onQuestionCreate(e)}
        ></question-list>
      `;
    }

    if (r.view === 'question-editor') {
      return html`
        <top-nav .activeSection=${'questions'}></top-nav>
        <question-editor .slug=${r.slug} .isNew=${r.isNew ?? false}></question-editor>
      `;
    }

    if (r.view === 'datasources') {
      return html`
        <top-nav .activeSection=${'datasources'}></top-nav>
        <datasource-list
          @datasource-select=${(e: CustomEvent<{ slug: string }>) =>
            this._navigate({ view: 'datasource-editor', slug: e.detail.slug })}
          @datasource-create=${(e: CustomEvent<{ name: string }>) => this._onDatasourceCreate(e)}
        ></datasource-list>
      `;
    }

    if (r.view === 'datasource-editor') {
      return html`
        <top-nav .activeSection=${'datasources'}></top-nav>
        <datasource-editor .slug=${r.slug} .isNew=${r.isNew ?? false}></datasource-editor>
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

export class Dashboard extends AppShell {}

if (!customElements.get('app-shell')) {
  customElements.define('app-shell', AppShell);
}

if (!customElements.get('app-dashboard')) {
  customElements.define('app-dashboard', Dashboard);
}
