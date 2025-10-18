// ./components/dropdown-component-lit.js
import { html, css, LitElement } from "lit";

export class DropdownComponent extends LitElement {
  static properties = {
    data: { type: Array },
    name: { type: String },
    selectedValues: { type: Array },
  };

  static styles = css`
    .select-container {
      margin: 16px 0;
    }

    label {
      font-weight: 600;
      display: block;
      margin-bottom: 8px;
    }

    select.multi-select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      min-height: 100px;
    }

    select.multi-select option {
      padding: 4px;
    }

    .empty {
      color: #999;
    }
  `;

  constructor() {
    super();
    this.data = [];
    this.name = "";
    this.selectedValues = [];
  }

  handleChange(event) {
    const select = event.target;
    this.selectedValues = Array.from(select.selectedOptions).map(
      (opt) => opt.value
    );

    this.dispatchEvent(
      new CustomEvent("valuechange", {
        detail: { name: this.name, value: this.selectedValues },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.data || !Array.isArray(this.data)) {
      return html`<p class="empty">Loading products...</p>`;
    }

    const products = this.data.map((row) => row.product);

    return html`
      <div class="select-container">
        <label for="select-${this.name}">Select products:</label>
        <select
          id="select-${this.name}"
          name="${this.name}"
          class="multi-select"
          multiple
          @change=${this.handleChange}
        >
          ${products.map(
            (product) => html`
              <option
                value="${product}"
                ?selected=${this.selectedValues.includes(product)}
              >
                ${product}
              </option>
            `
          )}
        </select>
      </div>
    `;
  }
}

customElements.define("dropdown-component", DropdownComponent);
