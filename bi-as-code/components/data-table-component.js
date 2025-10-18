// ./components/data-table-component.js
class DataTableComponent extends HTMLElement {
  constructor() {
    super();
    this._data = null;
  }

  connectedCallback() {
    this.render();
  }

  set data(value) {
    this._data = value;
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    if (!this._data || !Array.isArray(this._data) || this._data.length === 0) {
      this.innerHTML =
        '<p style="color: #999;">Data not available or empty</p>';
      return;
    }

    const columns = Object.keys(this._data[0]);
    const html = `
      <div style="border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8f9fa;">
              ${columns
                .map(
                  (col) =>
                    `<th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600;">${col}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${this._data
              .map(
                (row) => `
              <tr style="border-bottom: 1px solid #eee;">
                ${columns
                  .map(
                    (col) =>
                      `<td style="padding: 10px;">${
                        row[col] !== null ? row[col] : "<em>null</em>"
                      }</td>`
                  )
                  .join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    this.innerHTML = html;
  }
}

customElements.define("data-table-component", DataTableComponent);
