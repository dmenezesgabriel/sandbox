// ./components/data-table-component-lit.js
import { html, css, LitElement } from "lit";

export class DataTableComponent extends LitElement {
  static properties = {
    data: { type: Array },
  };

  static styles = css`
    .table-container {
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
      margin: 16px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead tr {
      background: #f8f9fa;
    }

    th {
      padding: 10px;
      text-align: left;
      border-bottom: 2px solid #ddd;
      font-weight: 600;
    }

    td {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }

    .empty {
      color: #999;
    }
  `;

  constructor() {
    super();
    this.data = [];
  }

  render() {
    if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
      return html`<p class="empty">Data not available or empty</p>`;
    }

    const columns = Object.keys(this.data[0]);

    return html`
      <div class="table-container">
        <table>
          <thead>
            <tr>
              ${columns.map((col) => html`<th>${col}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${this.data.map(
              (row) => html`
                <tr>
                  ${columns.map(
                    (col) =>
                      html`<td>
                        ${row[col] !== null ? row[col] : html`<em>null</em>`}
                      </td>`
                  )}
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

customElements.define("data-table-component", DataTableComponent);
