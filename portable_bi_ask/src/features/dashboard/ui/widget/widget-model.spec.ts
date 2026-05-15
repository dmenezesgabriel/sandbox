import { describe, expect, it } from 'vitest';

import type { WidgetConfig } from '../../../../shared/types/index';
import { buildWidgetChartConfig, getWidgetChartJsType } from './widget-model';

const baseConfig: WidgetConfig = {
  id: 'widget-1',
  type: 'chart',
  title: 'Sales by Region',
};

describe('widget-model', () => {
  describe('getWidgetChartJsType', () => {
    it('maps donut to doughnut and area to line', () => {
      expect(getWidgetChartJsType('donut')).toBe('doughnut');
      expect(getWidgetChartJsType('area')).toBe('line');
    });

    it('falls back to bar for unknown or missing chart types', () => {
      expect(getWidgetChartJsType(undefined)).toBe('bar');
      expect(getWidgetChartJsType('unknown')).toBe('bar');
    });
  });

  describe('buildWidgetChartConfig', () => {
    it('creates a filled line chart config for area charts', () => {
      const config = buildWidgetChartConfig(
        { ...baseConfig, chartType: 'area' },
        { labels: ['West', 'East'], values: [10, 20] },
      );

      expect(config.type).toBe('line');
      expect(config.data.labels).toEqual(['West', 'East']);
      expect(config.data.datasets[0]).toMatchObject({
        label: 'Sales by Region',
        data: [10, 20],
        fill: true,
        borderColor: '#c9613f',
      });
      expect(config.data.datasets[0].backgroundColor).toBe('rgba(201, 97, 63, 0.1)');
    });

    it('keeps legend hidden for dashboard widget charts', () => {
      const config = buildWidgetChartConfig(
        { ...baseConfig, chartType: 'pie' },
        { labels: ['West', 'East'], values: [10, 20] },
      );

      expect(config.options?.plugins?.legend).toEqual({ display: false });
    });
  });
});
