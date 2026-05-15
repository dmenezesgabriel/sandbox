import type { ChartConfiguration } from 'chart.js';

import type { WidgetConfig } from '../../../../shared/types/index';

type WidgetChartJsType = 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'bubble';

const CHART_COLORS = [
  '#c9613f',
  '#4a8c6f',
  '#2d6a8f',
  '#c8963e',
  '#8b6f9e',
  '#d9756a',
  '#6bb5a0',
  '#b89b6b',
  '#d48466',
  '#5a9e82',
] as const;

export function getWidgetChartJsType(chartType?: string): WidgetChartJsType {
  const map: Record<string, WidgetChartJsType> = {
    bar: 'bar',
    line: 'line',
    pie: 'pie',
    donut: 'doughnut',
    scatter: 'scatter',
    bubble: 'bubble',
    area: 'line',
  };
  return map[chartType ?? 'bar'] ?? 'bar';
}

export function buildWidgetChartConfig(
  config: Pick<WidgetConfig, 'title' | 'chartType'>,
  data: { labels: string[]; values: number[] },
): ChartConfiguration<WidgetChartJsType> {
  const chartType = getWidgetChartJsType(config.chartType);
  const isLineChart = chartType === 'line' || config.chartType === 'area';

  return {
    type: chartType,
    data: {
      labels: data.labels,
      datasets: [
        {
          label: config.title,
          data: data.values,
          backgroundColor: isLineChart ? 'rgba(201, 97, 63, 0.1)' : [...CHART_COLORS],
          borderColor: '#c9613f',
          borderWidth: isLineChart ? 2 : 1,
          fill: config.chartType === 'area' || isLineChart,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  };
}
