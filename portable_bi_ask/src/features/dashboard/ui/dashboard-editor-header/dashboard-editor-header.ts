import '../../../../shared/ui/app-breadcrumb';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

export type DashboardMode = 'dashboard' | 'askData';

export class DashboardEditorHeader extends LitElement {
  static override readonly properties = {
    title: { type: String },
    subtitle: { type: String },
    mode: { type: String },
    editMode: { type: Boolean },
  };

  override title = '';
  subtitle = '';
  mode: DashboardMode = 'dashboard';
  editMode = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _selectMode(m: DashboardMode): void {
    this.dispatchEvent(
      new CustomEvent<DashboardMode>('mode-change', {
        detail: m,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggleEdit(): void {
    this.dispatchEvent(
      new CustomEvent<{ editMode: boolean }>('edit-mode-toggle', {
        detail: { editMode: !this.editMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _modeClass(m: DashboardMode): string {
    return this.mode === m ? 'editor-mode-btn-active' : '';
  }

  private get _breadcrumbItems() {
    return [{ label: 'Dashboards', href: '#/' }, { label: this.title || 'Untitled Dashboard' }];
  }

  override render(): TemplateResult {
    return html`
      <div class="editor-header">
        <app-breadcrumb .items=${this._breadcrumbItems}></app-breadcrumb>
        <div class="editor-header-main">
          <div class="editor-header-identity">
            <h1 class="editor-header-title">${this.title}</h1>
            ${this.subtitle
              ? html`<p class="editor-header-subtitle">${this.subtitle}</p>`
              : nothing}
          </div>

          <div class="editor-header-controls">
            <div class="editor-mode-group" role="tablist" aria-label="Dashboard mode">
              <button
                id="tab-dashboard"
                role="tab"
                class="editor-mode-btn ${this._modeClass('dashboard')}"
                aria-selected=${this.mode === 'dashboard'}
                aria-controls="panel-dashboard"
                @click=${() => this._selectMode('dashboard')}
              >
                Editor
              </button>
              <button
                id="tab-ask-data"
                role="tab"
                class="editor-mode-btn ${this._modeClass('askData')}"
                aria-selected=${this.mode === 'askData'}
                aria-controls="panel-ask-data"
                @click=${() => this._selectMode('askData')}
              >
                Ask Data
              </button>
            </div>

            <button
              class="editor-edit-btn ${this.editMode ? 'active' : ''}"
              @click=${this._toggleEdit}
            >
              ${this.editMode ? 'Done Editing' : 'Edit'}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('dashboard-editor-header')) {
  customElements.define('dashboard-editor-header', DashboardEditorHeader);
}
