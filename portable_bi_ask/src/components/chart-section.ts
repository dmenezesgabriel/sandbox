import Chart from 'chart.js/auto';
import { html, LitElement, type PropertyValues, type TemplateResult } from 'lit';

import type { ChartDataResult } from '../types';

export class ChartSection extends LitElement {
  static override readonly properties = {
    chartData: { type: Array },
  };

  chartData: ChartDataResult[] = [];

  private _instances: Record<string, Chart> = {};

  override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('chartData')) this._draw();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._destroyAll();
  }

  private _destroyAll(): void {
    Object.values(this._instances).forEach((inst) => {
      try {
        inst.destroy();
      } catch (err: unknown) {
        console.error('Chart destroy failed:', err);
      }
    });
    this._instances = {};
  }

  private _draw(): void {
    this._destroyAll();
    this.chartData.forEach(({ chartDef, labels, data }) => {
      const canvas = this.querySelector<HTMLCanvasElement>(`#${chartDef.id}`);
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      this._instances[chartDef.id] = new Chart(ctx, {
        type: chartDef.type,
        data: { labels, datasets: [{ label: chartDef.title || chartDef.id, data }] },
        options: chartDef.options || {},
      });
    });
  }

  override render(): TemplateResult {
    return html`
      <section id="viz-section">
        ${this.chartData.map(
          ({ chartDef }) => html`
            <div class="chart-card">
              <canvas id="${chartDef.id}"></canvas>
            </div>
          `,
        )}
      </section>
    `;
  }
}

if (!customElements.get('chart-section')) {
  customElements.define('chart-section', ChartSection);
}
