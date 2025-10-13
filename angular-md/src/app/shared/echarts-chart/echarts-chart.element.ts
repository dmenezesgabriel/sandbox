import { LitElement, html } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import * as echarts from 'echarts'; // NEW: Import echarts directly

@customElement('lit-echarts-chart')
export class EchartsChartElement extends LitElement {
  // Receives the ECharts option object as a JSON string
  @property({ type: String })
  options: string = '{}';

  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private chartContainer: HTMLDivElement | null = null; // Reference to the inner div

  // Use the shadow root to protect the chart from global styles
  protected override createRenderRoot() {
    // Keep the shadow root, but ensure the chart can initialize inside the inner div
    return super.createRenderRoot();
  }

  // Lifecycle method called after the first update (first render)
  public override firstUpdated() {
    // Find the actual chart container div inside the shadow DOM
    this.chartContainer = this.shadowRoot?.querySelector(
      '#chart-container'
    ) as HTMLDivElement;

    if (this.chartContainer) {
      this.initializeChart(this.chartContainer);
      this.setupResizeObserver();
    }
  }

  private initializeChart(container: HTMLDivElement): void {
    // Dispose of old instance if present
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }

    // Initialize ECharts instance in the custom element
    this.chartInstance = echarts.init(container);
    this.updateChart();
  }

  private setupResizeObserver(): void {
    if (!this.chartContainer) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.chartInstance?.resize();
    });
    // Observe the Lit component itself (this) to detect size changes
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

  // Lit lifecycle hook for property changes
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
    // Provide a container div with a size for ECharts to render into
    return html`<div
      id="chart-container"
      style="height: 300px; width: 100%;"
    ></div>`;
  }
}
