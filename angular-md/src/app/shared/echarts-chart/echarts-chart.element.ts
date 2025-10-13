import { LitElement, html } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import * as echarts from 'echarts';

@customElement('lit-echarts-chart')
export class EchartsChartElement extends LitElement {
  @property({ type: String })
  options: string = '{}';

  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private chartContainer: HTMLDivElement | null = null;

  protected override createRenderRoot() {
    return super.createRenderRoot();
  }

  public override firstUpdated() {
    this.chartContainer = this.shadowRoot?.querySelector(
      '#chart-container'
    ) as HTMLDivElement;

    if (this.chartContainer) {
      this.initializeChart(this.chartContainer);
      this.setupResizeObserver();
    }
  }

  private initializeChart(container: HTMLDivElement): void {
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }

    this.chartInstance = echarts.init(container);
    this.updateChart();
  }

  private setupResizeObserver(): void {
    if (!this.chartContainer) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.chartInstance?.resize();
    });
    this.resizeObserver.observe(this);
  }

  private updateChart(): void {
    if (!this.chartInstance) return;

    try {
      const chartOptions = JSON.parse(this.options);
      this.chartInstance.setOption(chartOptions);
    } catch (e) {
      console.error('Invalid ECharts options JSON:', e);
    }
  }

  public override updated(
    changedProperties: Map<string | number | symbol, unknown>
  ): void {
    if (changedProperties.has('options')) {
      this.updateChart();
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.chartInstance?.dispose();
    this.chartInstance = null;
    this.resizeObserver?.unobserve(this);
    this.resizeObserver = null;
  }

  public override render() {
    return html`<div
      id="chart-container"
      style="height: 300px; width: 100%;"
    ></div>`;
  }
}
