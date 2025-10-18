// ./components/vegalite-chart.js
import vegaEmbed from "vega-embed";

class VegaLiteChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._spec = null;
    this._data = null;
  }

  connectedCallback() {
    this.renderChart();
  }

  set spec(val) {
    // Accept either string or object
    try {
      this._spec = typeof val === "string" ? JSON.parse(val) : val;
    } catch (err) {
      console.error("Invalid spec passed to vegalite-chart:", err);
      this._spec = null;
    }
    this.renderChart();
  }

  set data(val) {
    this._data = val;
    this.renderChart();
  }

  get spec() {
    return this._spec;
  }

  get data() {
    return this._data;
  }

  renderChart() {
    if (!this._spec) {
      this.shadowRoot.innerHTML = `<div style="color:#999;padding:12px;">No chart spec provided</div>`;
      return;
    }

    const spec = JSON.parse(JSON.stringify(this._spec));
    if (this._data && Array.isArray(this._data)) {
      spec.data = { values: this._data };
    }

    this.shadowRoot.innerHTML = `<div id="chart" style="width:100%;"></div>`;

    const chartDiv = this.shadowRoot.querySelector("#chart");
    if (chartDiv) {
      vegaEmbed(chartDiv, spec).catch((e) => {
        console.error("vegaEmbed error:", e);
        chartDiv.innerHTML = `<div style="color:#c33;padding:8px;">Chart render error</div>`;
      });
    }
  }
}

customElements.define("vegalite-chart", VegaLiteChart);
