import { html, LitElement, type TemplateResult } from 'lit';

import type { CellValue, KpiConfig } from '../types';

export class KpiCards extends LitElement {
  static override readonly properties = {
    kpis: { type: Array },
    results: { type: Array },
  };

  kpis: KpiConfig[] = [];
  results: CellValue[] = [];

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <section id="kpi-cards">
        ${this.kpis.map(
          (kpi, i) => html`
            <div class="kpi-card">
              <div class="kpi-title">${kpi.title}</div>
              <div class="kpi-value">
                ${kpi.format ? kpi.format(this.results[i]) : this.results[i]}
              </div>
            </div>
          `,
        )}
      </section>
    `;
  }
}

if (!customElements.get('kpi-cards')) {
  customElements.define('kpi-cards', KpiCards);
}
