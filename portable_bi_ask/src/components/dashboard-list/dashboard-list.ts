import '../ui-button';
import '../ui-text-field';

import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
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
    _createNameError: { state: true },
  };

  private _viewMode: ViewMode = 'grid';
  private _showCreateModal = false;
  private _newDashboardName = '';
  private _createNameError = '';
  private _dialogRef = createRef<HTMLDialogElement>();
  private _triggerEl: HTMLElement | null = null;

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
    this._triggerEl = document.activeElement as HTMLElement;
    this._showCreateModal = true;
    this._newDashboardName = '';
    this._createNameError = '';
    this.updateComplete.then(() => this._dialogRef.value?.showModal());
  }

  private _closeCreateModal(): void {
    this._dialogRef.value?.close();
  }

  private _onDialogClose(): void {
    this._showCreateModal = false;
    this._triggerEl?.focus();
    this._triggerEl = null;
  }

  private _createDashboard(): void {
    if (!this._newDashboardName.trim()) {
      this._createNameError = 'Please enter a dashboard name.';
      return;
    }
    this._createNameError = '';
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
    const nameAriaDescribedBy = this._createNameError ? 'name-error' : nothing;
    const nameAriaInvalid = this._createNameError ? 'true' : nothing;
    const nameError = this._createNameError
      ? html`<p id="name-error" class="field-error" role="alert">${this._createNameError}</p>`
      : nothing;
    const describedBy = typeof nameAriaDescribedBy === 'string' ? nameAriaDescribedBy : undefined;
    const invalid = typeof nameAriaInvalid === 'string' ? nameAriaInvalid : undefined;

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
              <ui-button
                .variant=${'primary'}
                .size=${'lg'}
                .content=${html`${icon(Plus, { size: 18 })} New Dashboard`}
                @click=${this._openCreateModal}
              ></ui-button>
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
              <dialog
                class="modal-content"
                aria-labelledby="create-dialog-title"
                @close=${this._onDialogClose}
                @click=${(e: Event) => {
                  if (e.target === e.currentTarget) this._closeCreateModal();
                }}
                ${ref(this._dialogRef)}
              >
                <h3 id="create-dialog-title">Create New Dashboard</h3>
                <div class="form-group">
                  <label for="new-dashboard-name">Name</label>
                  <ui-text-field
                    .inputId=${'new-dashboard-name'}
                    .value=${this._newDashboardName}
                    .placeholder=${'Enter dashboard name'}
                    .describedBy=${describedBy}
                    .invalid=${invalid}
                    .autoFocus=${true}
                    @value-change=${(e: CustomEvent<string>) => {
                      this._newDashboardName = e.detail;
                      this._createNameError = '';
                    }}
                    @enter-press=${this._createDashboard}
                  ></ui-text-field>
                  ${nameError}
                </div>
                <div class="modal-actions">
                  <ui-button
                    .variant=${'secondary'}
                    .content=${'Cancel'}
                    @click=${this._closeCreateModal}
                  ></ui-button>
                  <ui-button
                    .variant=${'primary'}
                    .content=${'Create'}
                    @click=${this._createDashboard}
                  ></ui-button>
                </div>
              </dialog>
            `
          : nothing}
      </section>
    `;
  }
}

if (!customElements.get('dashboard-list')) {
  customElements.define('dashboard-list', DashboardList);
}
