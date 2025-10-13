import { LitElement, html, unsafeCSS } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

const STYLES = `
.simple-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin: 16px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background: white;
}
.simple-table th, .simple-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}
.simple-table th {
  background-color: #f7fafc;
  color: #2d3748;
  font-weight: 600;
  text-transform: uppercase;
}
.simple-table tr:hover {
  background-color: #edf2f7;
}
`;

@customElement('lit-simple-table')
export class SimpleTableElement extends LitElement {
  public static style = unsafeCSS(STYLES);

  // Receives the data (either array of objects or object of arrays) as a JSON string
  @property({ type: String })
  data: string = '[]';

  // Receives column configuration (optional) as a JSON string
  @property({ type: String })
  columnconfig: string = '[]';

  private parsedData: Record<string, any>[] = [];
  private columns: string[] = [];

  // Lifecycle method called before render to process properties
  protected override willUpdate(
    changedProperties: Map<string | number | symbol, unknown>
  ): void {
    if (changedProperties.has('data')) {
      this.processData();
    }
  }

  private processData(): void {
    try {
      const rawData = JSON.parse(this.data);

      if (Array.isArray(rawData)) {
        // Data is Array of Objects: [ {Name: 'A'}, {Name: 'B'} ]
        this.parsedData = rawData;
        this.columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];
      } else if (typeof rawData === 'object' && rawData !== null) {
        // Data is Object of Arrays: { Name: ['A', 'B'], Age: [33, 27] }
        this.columns = Object.keys(rawData);
        const numRows =
          this.columns.length > 0 ? rawData[this.columns[0]].length : 0;

        this.parsedData = [];
        for (let i = 0; i < numRows; i++) {
          const row: Record<string, any> = {};
          for (const col of this.columns) {
            row[col] = rawData[col][i];
          }
          this.parsedData.push(row);
        }
      } else {
        this.parsedData = [];
        this.columns = [];
      }
    } catch (e) {
      console.error('Invalid Table Data JSON:', e);
      this.parsedData = [];
      this.columns = [];
    }
  }

  public override render() {
    if (this.parsedData.length === 0) {
      return html`<p>No data to display in the table.</p>`;
    }

    return html`
      <table class="simple-table">
        <thead>
          <tr>
            ${repeat(this.columns, (col) => html`<th>${col}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${repeat(
            this.parsedData,
            (row) => html`
              <tr>
                ${repeat(this.columns, (col) => html`<td>${row[col]}</td>`)}
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }
}
