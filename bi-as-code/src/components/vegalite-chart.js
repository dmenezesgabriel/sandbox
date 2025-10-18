import { html, css, LitElement } from "lit";
import vegaEmbed from "vega-embed";

export class VegaLiteChart extends LitElement {
  static properties = {
    spec: { type: Object },
    data: { type: Array },
  };

  static styles = css`
    #chart {
      width: 100%;
    }
    .empty {
      color: #999;
      padding: 12px;
    }
    .error {
      color: #c33;
      padding: 8px;
    }
  `;

  constructor() {
    super();
    this.spec = null;
    this.data = null;
  }

  updated(changedProperties) {
    if (changedProperties.has("spec") || changedProperties.has("data")) {
      this.renderChart();
    }
  }

  async renderChart() {
    const chartDiv = this.renderRoot.querySelector("#chart");
    if (!chartDiv) return;

    if (!this.spec) {
      chartDiv.innerHTML = `<div class="empty">No chart spec provided</div>`;
      return;
    }

    const specCopy = JSON.parse(JSON.stringify(this.spec));
    if (this.data && Array.isArray(this.data)) {
      specCopy.data = { values: this.data };
    }

    try {
      await vegaEmbed(chartDiv, specCopy);
    } catch (e) {
      console.error("vegaEmbed error:", e);
      chartDiv.innerHTML = `<div class="error">Chart render error</div>`;
    }
  }

  render() {
    return html`<div id="chart"></div>`;
  }
}

customElements.define("vegalite-chart", VegaLiteChart);
