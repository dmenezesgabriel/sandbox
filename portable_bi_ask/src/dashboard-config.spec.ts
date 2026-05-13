import { describe, expect, it } from 'vitest';

import { createEmptyDashboardConfig } from './dashboard-config';
import { dashboardRegistry } from './dashboard-registry';
import type { DataSourceConfig } from './types';

describe('createEmptyDashboardConfig', () => {
  it('uses explicit app defaults instead of the first registered dashboard', () => {
    const config = createEmptyDashboardConfig('New Dashboard');

    expect(config.title).toBe('New Dashboard');
    expect(config.subtitle).toBe('');
    expect(config.dataSources).toEqual([]);
    expect(config.askData).toEqual({ defaultQuestion: '' });
    expect(config.filters).toEqual([]);
    expect(config.kpis).toEqual([]);
    expect(config.charts).toEqual([]);
    expect(config.tables).toEqual([]);
    expect(config.layout).toEqual([]);
    expect(config.relationships).toEqual([]);
  });

  it('returns fresh dashboard-local collections on each call', () => {
    const first = createEmptyDashboardConfig('First');
    const second = createEmptyDashboardConfig('Second');

    expect(first.dataSources).not.toBe(second.dataSources);
    expect(first.askData).not.toBe(second.askData);
    expect(first.filters).not.toBe(second.filters);
  });

  it('does not share mutable dashboard-local config with the registry seed dashboard', () => {
    const config = createEmptyDashboardConfig('Scratch');
    config.dataSources.push({ name: 'tmp', url: 'tmp.csv' } as DataSourceConfig);
    config.askData.defaultQuestion = 'temporary';

    const seeded = dashboardRegistry['portable-bi-dashboard'];
    expect(seeded.dataSources).toHaveLength(3);
    expect(seeded.askData.defaultQuestion).toBe('sales by region');
  });
});
