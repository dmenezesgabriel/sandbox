import { html, LitElement, type TemplateResult } from 'lit';
import { LayoutGrid } from 'lucide';

import { dashboardList } from '../../dashboard-registry';
import { icon } from '../../icons';
import type { DashboardConfig } from '../../types';

export class DashboardList extends LitElement {
  static override readonly properties = {
    dashboards: { type: Array },
  };

  dashboards: { slug: string; config: DashboardConfig }[] = [];

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent('dashboard-select', { detail: { slug }, bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    const entries = dashboardList;

    return html`
      <section class="dashboard-list-page">
        <div class="dashboard-hero">
          <div class="dashboard-hero-inner">
            <h1 class="dashboard-hero-title">
              <span class="dashboard-hero-mark">${icon(LayoutGrid, { size: 32 })}</span>
              Dashboards
            </h1>
            <p class="dashboard-hero-subtitle">Your Data, Any Data, Instantly Explained</p>
          </div>
        </div>

        <div class="dashboard-grid">
          ${entries.map(
            ({ slug, config }) => html`
              <button class="dashboard-card" @click=${() => this._onSelect(slug)}>
                <div class="dashboard-card-icon">${icon(LayoutGrid, { size: 28 })}</div>
                <div class="dashboard-card-body">
                  <h3 class="dashboard-card-title">${config.title}</h3>
                  <p class="dashboard-card-desc">${config.subtitle}</p>
                  <div class="dashboard-card-meta">
                    <span>${config.kpis.length} KPIs</span>
                    <span>${config.charts.length} charts</span>
                    <span>${config.tables.length} tables</span>
                  </div>
                </div>
                <span class="dashboard-card-arrow">→</span>
              </button>
            `,
          )}
        </div>
      </section>
    `;
  }
}

if (!customElements.get('dashboard-list')) {
  customElements.define('dashboard-list', DashboardList);
}
