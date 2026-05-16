import '../../../../shared/ui/app-breadcrumb';

import { html, LitElement, nothing, type TemplateResult } from 'lit';

export class DatasourceEditorHeader extends LitElement {
  static override readonly properties = {
    title: { type: String },
    isNew: { type: Boolean },
    isDirty: { type: Boolean },
    isYaml: { type: Boolean },
  };

  override title = '';
  isNew = false;
  isDirty = false;
  isYaml = false;

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    const saveBtnClass = `qeh-save-btn${this.isDirty ? ' dirty' : ''}`;
    const saveLabel = this.isNew ? 'Create' : 'Save';
    const deleteBtn =
      this.isNew || this.isYaml
        ? nothing
        : html`
            <button
              class="qeh-delete-btn"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('datasource-delete', { bubbles: true, composed: true }),
                )}
            >
              Delete
            </button>
          `;
    const exportBtn = this.isNew
      ? nothing
      : html`
          <button
            class="qeh-export-btn"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('datasource-export', { bubbles: true, composed: true }),
              )}
          >
            Export YAML
          </button>
        `;

    const saveAndDelete =
      this.isYaml || this.isNew
        ? nothing
        : html`
            <button
              class="${saveBtnClass}"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('datasource-save', { bubbles: true, composed: true }),
                )}
            >
              ${saveLabel}
            </button>
            ${deleteBtn}
          `;
    const createBtn =
      this.isNew && !this.isYaml
        ? html`
            <button
              class="${saveBtnClass}"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('datasource-save', { bubbles: true, composed: true }),
                )}
            >
              ${saveLabel}
            </button>
          `
        : nothing;
    const rightPanel = html`
      <div class="qeh-right">${exportBtn} ${saveAndDelete} ${createBtn}</div>
    `;

    return html`
      <div class="qeh-header">
        <app-breadcrumb
          .items=${[
            { label: 'Datasources', href: '#/datasources' },
            { label: this.title || 'Untitled Datasource' },
          ]}
        ></app-breadcrumb>
        <div class="qeh-header-main">
          <div class="qeh-left">
            <h1 class="qeh-title">${this.title || 'Untitled Datasource'}</h1>
            ${this.isDirty
              ? html`<span class="qeh-dirty-dot" title="Unsaved changes"></span>`
              : nothing}
          </div>
          ${rightPanel}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('datasource-editor-header')) {
  customElements.define('datasource-editor-header', DatasourceEditorHeader);
}
