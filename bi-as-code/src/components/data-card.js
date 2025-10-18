// ./components/data-card.js
import { html, css, LitElement } from "lit";

export class DataCard extends LitElement {
  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 16px 0;
    }

    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
    }

    .key {
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .value {
      font-size: 24px;
      font-weight: 700;
    }

    p {
      color: #999;
    }
  `;

  static properties = {
    data: { type: Array },
  };

  constructor() {
    super();
    this.data = [];
  }

  render() {
    if (!this.data || this.data.length === 0) {
      return html`<p>Data not available</p>`;
    }

    const record = this.data[0];

    return html`
      <div class="grid">
        ${Object.entries(record).map(
          ([key, value]) => html`
            <div class="card">
              <div class="key">${key.replace(/_/g, " ")}</div>
              <div class="value">
                ${typeof value === "number"
                  ? value.toLocaleString()
                  : parseFloat(value).toLocaleString()}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}

customElements.define("data-card", DataCard);
