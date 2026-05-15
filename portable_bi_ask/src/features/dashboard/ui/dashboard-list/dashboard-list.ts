import { html, type TemplateResult } from 'lit';
import { LayoutGrid } from 'lucide';

import type { DashboardConfig } from '../../../../shared/types/index';
import { CollectionList } from '../../../../shared/ui/collection-list/collection-list';
import { icon } from '../../../../shared/utils/icons';
import { dashboardList } from '../../data/dashboard-registry';

export class DashboardList extends CollectionList {
  public override get title(): string {
    return 'Dashboards';
  }

  protected override get subtitle(): string {
    return 'Your Data, Any Data, Instantly Explained';
  }

  protected override get createDialogTitle(): string {
    return 'Create New Dashboard';
  }

  protected override get createNameLabel(): string {
    return 'Name';
  }

  protected override get createNamePlaceholder(): string {
    return 'Enter dashboard name';
  }

  protected override get createButtonLabel(): string {
    return 'New Dashboard';
  }

  protected override get itemCount(): number {
    return dashboardList.length;
  }

  protected override get itemCountLabel(): string {
    return 'dashboard';
  }

  protected override _titleIcon(): TemplateResult {
    return icon(LayoutGrid, { size: 32 });
  }

  protected override _handleCreate(): void {
    this.dispatchEvent(
      new CustomEvent('dashboard-create', {
        detail: { name: this._newItemName.trim() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent('dashboard-select', { detail: { slug }, bubbles: true, composed: true }),
    );
  }

  protected override _renderGridItems(): TemplateResult {
    return html`
      <div class="dashboard-grid">
        ${dashboardList.map(
          ({ slug, config }: { slug: string; config: DashboardConfig }) => html`
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
    `;
  }

  protected override _renderListItems(): TemplateResult {
    return html`
      <div class="dashboard-list-table">
        <div class="dashboard-list-header">
          <span class="dashboard-list-col dashboard-list-col-name">Name</span>
          <span class="dashboard-list-col dashboard-list-col-desc">Description</span>
          <span class="dashboard-list-col dashboard-list-col-meta">Widgets</span>
          <span class="dashboard-list-col dashboard-list-col-action"></span>
        </div>
        ${dashboardList.map(
          ({ slug, config }: { slug: string; config: DashboardConfig }) => html`
            <button class="dashboard-list-row" @click=${() => this._onSelect(slug)}>
              <span class="dashboard-list-col dashboard-list-col-name">
                <span class="dashboard-list-row-icon">${icon(LayoutGrid, { size: 16 })}</span>
                <span class="dashboard-list-row-title">${config.title}</span>
              </span>
              <span class="dashboard-list-col dashboard-list-col-desc">${config.subtitle}</span>
              <span class="dashboard-list-col dashboard-list-col-meta">
                <span>${config.kpis.length}</span> KPIs
                <span class="dashboard-list-sep">·</span>
                <span>${config.charts.length}</span> charts
                <span class="dashboard-list-sep">·</span>
                <span>${config.tables.length}</span> tables
              </span>
              <span class="dashboard-list-col dashboard-list-col-action">
                <span class="dashboard-list-row-arrow">→</span>
              </span>
            </button>
          `,
        )}
      </div>
    `;
  }
}

if (!customElements.get('dashboard-list')) {
  customElements.define('dashboard-list', DashboardList);
}
