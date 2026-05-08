import { html, LitElement, nothing, type TemplateResult } from 'lit';

import type { DashboardFilterConfig, FilterOptions, Filters } from '../types';

export class FilterBar extends LitElement {
  static override readonly properties = {
    filterDefs: { type: Array },
    filterOptions: { type: Object },
    values: { type: Object },
  };

  filterDefs: DashboardFilterConfig[] = [];
  filterOptions: FilterOptions = {};
  values: Filters = {};

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private _onChange(event: Event, field: string): void {
    const target = event.target;
    const value = target instanceof HTMLSelectElement ? target.value : '';
    this.dispatchEvent(
      new CustomEvent<{ field: string; value: string }>('filter-change', {
        detail: { field, value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult {
    return html`
      <form id="filter-bar">
        ${this.filterDefs.map(
          (f) => html`
            <label>
              ${f.label}:
              <select
                name="${f.field}"
                .value=${this.values[f.field] || 'All'}
                @change=${(e: Event) => this._onChange(e, f.field)}
                style="margin-right:.8em;font-size:1em;padding:0.12em .9em;border-radius:.5em;border:1.5px solid #b0c4e7;background:#fff;"
              >
                ${this.filterOptions[f.field]?.map((o) => html`<option value=${o}>${o}</option>`) || nothing}
              </select>
            </label>
          `,
        )}
      </form>
    `;
  }
}

if (!customElements.get('filter-bar')) {
  customElements.define('filter-bar', FilterBar);
}
