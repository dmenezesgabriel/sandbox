import { html, LitElement, type TemplateResult } from 'lit';
import { LayoutGrid, List, Plus } from 'lucide';

import { dashboardList } from '../../dashboard-registry';
import { icon } from '../../icons';
import type { DashboardConfig } from '../../types';

type ViewMode = 'grid' | 'list';

export class DashboardList extends LitElement {
  static override readonly properties = {
    _viewMode: { state: true },
    _showCreateModal: { state: true },
    _newDashboardName: { state: true },
  };

  private _viewMode: ViewMode = 'grid';
  private _showCreateModal = false;
  private _newDashboardName = '';

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onSelect(slug: string): void {
    this.dispatchEvent(
      new CustomEvent('dashboard-select', { detail: { slug }, bubbles: true, composed: true }),
    );
  }

  private _setView(mode: ViewMode): void {
    this._viewMode = mode;
  }

  private _openCreateModal(): void {
    this._showCreateModal = true;
    this._newDashboardName = '';
  }

  private _closeCreateModal(): void {
    this._showCreateModal = false;
  }

  private _createDashboard(): void {
    if (!this._newDashboardName.trim()) return;
    this.dispatchEvent(
      new CustomEvent('dashboard-create', {
        detail: { name: this._newDashboardName.trim() },
        bubbles: true,
        composed: true,
      }),
    );
    this._closeCreateModal();
  }

  private _renderGridView(entries: { slug: string; config: DashboardConfig }[]): TemplateResult {
    return html`
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
    `;
  }

  private _renderListView(entries: { slug: string; config: DashboardConfig }[]): TemplateResult {
    return html`
      <div class="dashboard-list-table">
        <div class="dashboard-list-header">
          <span class="dashboard-list-col dashboard-list-col-name">Name</span>
          <span class="dashboard-list-col dashboard-list-col-desc">Description</span>
          <span class="dashboard-list-col dashboard-list-col-meta">Widgets</span>
          <span class="dashboard-list-col dashboard-list-col-action"></span>
        </div>
        ${entries.map(
          ({ slug, config }) => html`
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
            <div class="dashboard-hero-actions">
              <button class="btn-new-dashboard" @click=${this._openCreateModal}>
                ${icon(Plus, { size: 18 })} New Dashboard
              </button>
            </div>
          </div>
        </div>

        <div class="dashboard-toolbar">
          <div class="dashboard-toolbar-info">
            ${entries.length} dashboard${entries.length !== 1 ? 's' : ''}
          </div>
          <div class="dashboard-view-toggle">
            <button
              class="dashboard-view-btn ${this._viewMode === 'grid'
                ? 'dashboard-view-btn-active'
                : ''}"
              @click=${() => this._setView('grid')}
              title="Grid view"
            >
              ${icon(LayoutGrid, { size: 16 })}
            </button>
            <button
              class="dashboard-view-btn ${this._viewMode === 'list'
                ? 'dashboard-view-btn-active'
                : ''}"
              @click=${() => this._setView('list')}
              title="List view"
            >
              ${icon(List, { size: 16 })}
            </button>
          </div>
        </div>

        ${this._viewMode === 'grid' ? this._renderGridView(entries) : this._renderListView(entries)}
        ${this._showCreateModal
          ? html`
              <div class="modal-overlay" @click=${this._closeCreateModal}>
                <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
                  <h3>Create New Dashboard</h3>
                  <div class="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      .value=${this._newDashboardName}
                      @input=${(e: Event) => {
                        this._newDashboardName = (e.target as HTMLInputElement).value;
                      }}
                      @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this._createDashboard();
                      }}
                      placeholder="Enter dashboard name"
                      autofocus
                    />
                  </div>
                  <div class="modal-actions">
                    <button class="btn-cancel" @click=${this._closeCreateModal}>Cancel</button>
                    <button class="btn-save" @click=${this._createDashboard}>Create</button>
                  </div>
                </div>
              </div>
            `
          : ''}
      </section>
    `;
  }
}

if (!customElements.get('dashboard-list')) {
  customElements.define('dashboard-list', DashboardList);
}
