import { html, LitElement, type TemplateResult } from 'lit';

import type { CellValue, DataRow } from '../../types';

export class DataTable extends LitElement {
  static override readonly properties = {
    title: { type: String },
    columns: { type: Array },
    rows: { type: Array },
    columnFormats: { type: Object },
  };

  override title = '';
  columns: string[] = [];
  rows: DataRow[] = [];
  columnFormats: Record<string, (v: CellValue) => string> = {};

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <section id="table-section">
        <h2>${this.title}</h2>
        <div id="data-table-wrap">
          <table>
            <thead>
              <tr>
                ${this.columns.map((col) => html`<th>${col}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${this.rows.map(
                (row) => html`
                  <tr>
                    ${this.columns.map((col) => html`<td>${this.columnFormats[col] ? this.columnFormats[col](row[col]) : row[col]}</td>`)}
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }
}

if (!customElements.get('data-table')) {
  customElements.define('data-table', DataTable);
}
