import { html, LitElement, nothing, type TemplateResult } from 'lit';

import type { Sheet } from '../../types';

export class SheetsManager extends LitElement {
  static override readonly properties = {
    sheets: { type: Array },
    activeSheetId: { type: String },
    editMode: { type: Boolean },
  };

  sheets: Sheet[];
  activeSheetId: string | null;
  editMode: boolean;

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
      </div>
    `;
  }
}

if (!customElements.get('sheets-manager')) {
  customElements.define('sheets-manager', SheetsManager);
}
