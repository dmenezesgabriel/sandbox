import '../skeleton-loader';

import { html, LitElement, type TemplateResult } from 'lit';

import type { CellValue, KpiConfig } from '../../types';

export class KpiCards extends LitElement {
  static override readonly properties = {
    kpis: { type: Array },
    results: { type: Array },
  };

  kpis: KpiConfig[] = [];
  results: CellValue[] = [];

  private formatValue(format: string | undefined, value: CellValue): string {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        Number(value),
      );
    }
    return String(value);
  }

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
              ${this.results[i] !== undefined && this.results[i] !== null
                ? html`
                    <div class="kpi-value">${this.formatValue(kpi.format, this.results[i])}</div>
                  `
                : html`<skeleton-loader variant="line" .lines=${1}></skeleton-loader>`}
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
