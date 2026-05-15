import { html, type TemplateResult } from 'lit';
import { LayoutGrid } from 'lucide';

import { CollectionList } from '../../../../shared/ui/collection-list/collection-list';
import { icon } from '../../../../shared/utils/icons';
import { type DashboardEntry, dashboardList, deleteDashboard } from '../../data/dashboard-registry';

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

  private _onDelete(entry: DashboardEntry): void {
    if (!confirm(`Delete "${entry.config.title}"? This cannot be undone.`)) return;
    deleteDashboard(entry.slug);
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('dashboard-delete', {
        detail: { slug: entry.slug },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override _renderListItems(): TemplateResult {
    if (dashboardList.length === 0) {
      return html`
        <div class="collection-list-empty">
          <p>No dashboards yet. Create your first dashboard to get started.</p>
        </div>
      `;
    }
    return html`
      <div class="collection-list-table">
        <div class="collection-list-header">
          <span class="collection-list-col collection-list-col-name">Name</span>
          <span class="collection-list-col collection-list-col-desc">Description</span>
          <span class="collection-list-col collection-list-col-meta">Widgets</span>
          <span class="collection-list-col collection-list-col-actions"></span>
        </div>
        ${dashboardList.map(
          (entry: DashboardEntry) => html`
            <div
              class="collection-list-row"
              role="button"
              tabindex="0"
              @click=${() => this._onSelect(entry.slug)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this._onSelect(entry.slug);
              }}
            >
              <span class="collection-list-col collection-list-col-name">
                <span class="collection-list-row-icon">${icon(LayoutGrid, { size: 16 })}</span>
                <span class="collection-list-row-title">${entry.config.title}</span>
              </span>
              <span class="collection-list-col collection-list-col-desc"
                >${entry.config.subtitle}</span
              >
              <span class="collection-list-col collection-list-col-meta">
                <span>${entry.config.kpis.length}</span> KPIs
                <span class="collection-list-sep">·</span>
                <span>${entry.config.charts.length}</span> charts
                <span class="collection-list-sep">·</span>
                <span>${entry.config.tables.length}</span> tables
              </span>
              <span
                class="collection-list-col collection-list-col-actions"
                @click=${(e: Event) => e.stopPropagation()}
              >
                ${this._renderRowActions(
                  () => this._onSelect(entry.slug),
                  () => this._onSelect(entry.slug),
                  entry.source !== 'yaml' ? () => this._onDelete(entry) : null,
                )}
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

if (!customElements.get('dashboard-list')) {
  customElements.define('dashboard-list', DashboardList);
}
