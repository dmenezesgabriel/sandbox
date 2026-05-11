import { html, LitElement, nothing, type TemplateResult } from 'lit';

import type { Sheet } from '../../types';

export class SheetsManager extends LitElement {
  static override readonly properties = {
    sheets: { type: Array },
    activeSheetId: { type: String },
    editMode: { type: Boolean },
    _showNewSheetModal: { state: true },
    _newSheetName: { state: true },
  };

  sheets: Sheet[];
  activeSheetId: string | null;
  editMode: boolean;
  private _showNewSheetModal: boolean = false;
  private _newSheetName: string = '';

  constructor() {
    super();
    this.sheets = [];
    this.activeSheetId = null;
    this.editMode = false;
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _selectSheet(id: string): void {
    this.activeSheetId = id;
    this.dispatchEvent(
      new CustomEvent('sheet-select', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  private _deleteSheet(e: Event, id: string): void {
    e.stopPropagation();
    if (confirm('Delete this dashboard?')) {
      this.dispatchEvent(
        new CustomEvent('sheet-delete', { detail: { id }, bubbles: true, composed: true }),
      );
    }
  }

  private _toggleEditMode(): void {
    this.editMode = !this.editMode;
    this.dispatchEvent(
      new CustomEvent('edit-mode-toggle', {
        detail: { editMode: this.editMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _openNewSheetModal(): void {
    this._showNewSheetModal = true;
    this._newSheetName = '';
  }

  private _closeNewSheetModal(): void {
    this._showNewSheetModal = false;
  }

  private _createSheet(): void {
    if (!this._newSheetName.trim()) return;
    this.dispatchEvent(
      new CustomEvent('sheet-create', {
        detail: {
          name: this._newSheetName,
          type: 'dashboard' as const,
        },
        bubbles: true,
        composed: true,
      }),
    );
    this._closeNewSheetModal();
  }

  private _duplicateSheet(e: Event, sheet: Sheet): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('sheet-duplicate', { detail: { sheet }, bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    return html`
      <div class="sheets-manager">
        <div class="sheets-list">
          ${this.sheets.map(
            (sheet) => html`
              <div
                class="sheet-tab ${sheet.id === this.activeSheetId ? 'active' : ''}"
                @click=${() => this._selectSheet(sheet.id)}
              >
                <span class="sheet-icon">📊</span>
                <span class="sheet-name">${sheet.name}</span>
                ${this.editMode
                  ? html`
                      <div class="sheet-actions">
                        <button
                          class="sheet-btn"
                          @click=${(e: Event) => this._duplicateSheet(e, sheet)}
                          title="Duplicate"
                        >
                          ⧉
                        </button>
                        <button
                          class="sheet-btn"
                          @click=${(e: Event) => this._deleteSheet(e, sheet.id)}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    `
                  : nothing}
              </div>
            `,
          )}
        </div>

        <div class="sheets-toolbar">
          <button class="btn-new-sheet" @click=${this._openNewSheetModal}>+ New Dashboard</button>
          <button
            class="btn-edit-mode ${this.editMode ? 'active' : ''}"
            @click=${this._toggleEditMode}
          >
            ${this.editMode ? 'Done Editing' : 'Edit'}
          </button>
        </div>
      </div>

      ${this._showNewSheetModal
        ? html`
            <div class="modal-overlay" @click=${this._closeNewSheetModal}>
              <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
                <h3>Create New Dashboard</h3>
                <div class="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    .value=${this._newSheetName}
                    @input=${(e: Event) => {
                      this._newSheetName = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="Enter dashboard name"
                    autofocus
                  />
                </div>
                <div class="modal-actions">
                  <button class="btn-cancel" @click=${this._closeNewSheetModal}>Cancel</button>
                  <button class="btn-save" @click=${this._createSheet}>Create</button>
                </div>
              </div>
            </div>
          `
        : nothing}
    `;
  }
}

if (!customElements.get('sheets-manager')) {
  customElements.define('sheets-manager', SheetsManager);
}
