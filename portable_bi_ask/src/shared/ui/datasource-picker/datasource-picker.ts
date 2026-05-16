import '../ui-button';

import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import { datasourceList } from '../../../features/datasource/data/datasource-registry';
import type { DataSourceConfig } from '../../types/index';

export class DatasourcePicker extends LitElement {
  static override readonly properties = {
    open: { type: Boolean },
    selectedSlugs: { type: Array },
    _filter: { state: true },
    _pendingSlugs: { state: true },
  };

  open = false;
  selectedSlugs: string[] = [];

  private _filter = '';
  private _pendingSlugs: string[] = [];
  private _dialogRef = createRef<HTMLDialogElement>();

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('open')) {
      if (this.open) {
        this._filter = '';
        this._pendingSlugs = [...this.selectedSlugs];
        try {
          this._dialogRef.value?.showModal();
        } catch (err) {
          console.error('[datasource-picker] showModal failed:', err);
        }
      } else {
        this._dialogRef.value?.close();
      }
    }
  }

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _toggle(slug: string): void {
    if (this._pendingSlugs.includes(slug)) {
      this._pendingSlugs = this._pendingSlugs.filter((s) => s !== slug);
    } else {
      this._pendingSlugs = [...this._pendingSlugs, slug];
    }
  }

  private _confirm(): void {
    this.dispatchEvent(
      new CustomEvent<string[]>('datasources-selected', {
        detail: [...this._pendingSlugs],
        bubbles: true,
        composed: true,
      }),
    );
    this._close();
  }

  private _close(): void {
    this._dialogRef.value?.close();
  }

  private _onNativeClose(): void {
    this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
  }

  override render(): TemplateResult {
    const term = this._filter.toLowerCase();
    const items = datasourceList().filter(
      (ds) => !term || ds.name.toLowerCase().includes(term) || ds.url.toLowerCase().includes(term),
    );

    return html`
      <dialog
        class="qpicker-modal"
        aria-labelledby="dspicker-title"
        @close=${this._onNativeClose}
        ${ref(this._dialogRef)}
      >
        <div class="qpicker-header">
          <span id="dspicker-title" class="qpicker-title">Select datasources</span>
          <button class="qpicker-close" @click=${this._close} aria-label="Close">✕</button>
        </div>

        <div class="qpicker-search">
          <input
            class="qpicker-input"
            type="search"
            aria-label="Search datasources"
            placeholder="Search datasources…"
            .value=${this._filter}
            @input=${(e: Event) => {
              this._filter = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        <div class="qpicker-list">
          ${items.length === 0
            ? html`<p class="qpicker-empty">No datasources found.</p>`
            : items.map(
                (ds: DataSourceConfig) => html`
                  <label class="qpicker-item qpicker-item-check">
                    <input
                      type="checkbox"
                      class="qpicker-checkbox"
                      .checked=${this._pendingSlugs.includes(ds.slug)}
                      @change=${() => this._toggle(ds.slug)}
                    />
                    <span class="qpicker-item-body">
                      <span class="qpicker-item-title">${ds.name}</span>
                      ${ds.description
                        ? html`<span class="qpicker-item-desc">${ds.description}</span>`
                        : nothing}
                    </span>
                    <span class="qpicker-item-type ds-type-badge ds-type-${ds.type}"
                      >${ds.type.toUpperCase()}</span
                    >
                  </label>
                `,
              )}
        </div>

        <div class="qpicker-footer">
          <ui-button
            .variant=${'secondary'}
            .size=${'sm'}
            .content=${'Cancel'}
            @click=${this._close}
          ></ui-button>
          <ui-button
            .variant=${'primary'}
            .size=${'sm'}
            .content=${`Confirm (${this._pendingSlugs.length})`}
            @click=${this._confirm}
          ></ui-button>
        </div>
      </dialog>
    `;
  }
}

if (!customElements.get('datasource-picker')) {
  customElements.define('datasource-picker', DatasourcePicker);
}
