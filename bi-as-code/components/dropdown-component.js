class Dropdown extends HTMLElement {
  constructor() {
    super();
    this._data = null;
    this._name = "";
    this._selectedValues = [];
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

  set name(value) {
    this._name = value;
  }

  get name() {
    return this._name;
  }

  render() {
    if (!this._data) {
      this.innerHTML = '<p style="color: #999;">Loading products...</p>';
      return;
    }

    const style = `
      <style>
        .select-container { margin: 16px 0; }
        .multi-select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 100px; }
        .multi-select option { padding: 4px; }
        label { font-weight: 600; display: block; margin-bottom: 8px;}
      </style>
    `;

    const products = Array.isArray(this._data)
      ? this._data.map((row) => row.product)
      : [];

    const selectId =
      (this._name || "productSelect") +
      "-" +
      Math.random().toString(36).slice(2, 8);
    const html = `
      ${style}
      <div class="select-container">
        <label for="${selectId}">Select Products:</label>
        <select id="${selectId}" name="${
      this._name
    }" class="multi-select" multiple>
          ${products
            .map(
              (product) =>
                `<option value="${product}" ${
                  this._selectedValues.includes(product) ? "selected" : ""
                }>${product}</option>`
            )
            .join("")}
        </select>
      </div>
    `;

    this.innerHTML = html;

    const selectElement = this.querySelector(`#${selectId}`);
    if (selectElement) {
      selectElement.addEventListener("change", (e) => {
        const select = e.target;
        this._selectedValues = Array.from(select.selectedOptions).map(
          (opt) => opt.value
        );

        // Dispatch custom event with raw array of selected values
        this.dispatchEvent(
          new CustomEvent("valuechange", {
            detail: { name: this._name, value: this._selectedValues },
            bubbles: true,
          })
        );
      });
    }
  }
}

customElements.define("dropdown-component", Dropdown);
