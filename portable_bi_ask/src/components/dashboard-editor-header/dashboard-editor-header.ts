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

  override render(): TemplateResult {
    return html`
      <div class="editor-header">
        <div class="editor-header-identity">
          <h1 class="editor-header-title">${this.title}</h1>
          ${this.subtitle ? html`<p class="editor-header-subtitle">${this.subtitle}</p>` : nothing}
        </div>

        <div class="editor-header-controls">
          <div class="editor-mode-group" role="group" aria-label="Dashboard mode">
            <button
              id="tab-dashboard"
              class="editor-mode-btn ${this._modeClass('dashboard')}"
              aria-pressed=${this.mode === 'dashboard'}
              @click=${() => this._selectMode('dashboard')}
            >
              Editor
            </button>
            <button
              id="tab-ask-data"
              class="editor-mode-btn ${this._modeClass('askData')}"
              aria-pressed=${this.mode === 'askData'}
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
    `;
  }
}

if (!customElements.get('dashboard-editor-header')) {
  customElements.define('dashboard-editor-header', DashboardEditorHeader);
}
