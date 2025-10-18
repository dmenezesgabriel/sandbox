// ./components/data-card.js
class DataCard extends HTMLElement {
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
      this.innerHTML = '<p style="color: #999;">Data not available</p>';
      return;
    }

    const record = this._data[0];
    const html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0;">
        ${Object.entries(record)
          .map(
            ([key, value]) => `
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">${key.replace(
              /_/g,
              " "
            )}</div>
            <div style="color: white; font-size: 24px; font-weight: 700;">${
              typeof value === "number" ? value.toLocaleString() : value
            }</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
    this.innerHTML = html;
  }
}

customElements.define("data-card", DataCard);
