import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { dashboardRegistry, titleToSlug } from './dashboard-registry';
import type { DashboardConfig } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawYaml = readFileSync(resolve(__dirname, './dashboards/portable-bi-dashboard.yaml'), 'utf8');

describe('titleToSlug', () => {
  it('lowercases and replaces non-alphanumeric runs with hyphens', () => {
    expect(titleToSlug('Portable BI Dashboard')).toBe('portable-bi-dashboard');
  });

  it('strips leading and trailing hyphens', () => {
    expect(titleToSlug('--hello world--')).toBe('hello-world');
  });

  it('returns empty string for blank input', () => {
    expect(titleToSlug('')).toBe('');
  });
});

describe('dashboard-registry: observable formatting contract', () => {
  const config = dashboardRegistry['portable-bi-dashboard'];

  it('total-sales KPI has format: currency', () => {
    const kpi = config.kpis.find((k) => k.id === 'total-sales');
    expect(kpi?.format).toBe('currency');
  });

  it('combo-table has columnFormats.Sales: currency', () => {
    const table = config.tables.find((t) => t.id === 'combo-table');
    expect(table?.columnFormats?.Sales).toBe('currency');
  });

  it('other KPIs are not affected by currency formatting', () => {
    const config = dashboardRegistry['portable-bi-dashboard'];
    const others = config.kpis.filter((k) => k.id !== 'total-sales');
    for (const kpi of others) {
      expect(kpi.format).toBeUndefined();
    }
  });
});

// These tests fail until the YAML carries the formatting values directly.
// They prove processConfig() is no longer needed once the YAML is updated.
describe('portable-bi-dashboard YAML: carries formatting without code injection', () => {
  const rawConfig = parseYaml(rawYaml) as DashboardConfig;

  it('total-sales KPI declares format: currency in YAML', () => {
    const kpi = rawConfig.kpis.find((k) => k.id === 'total-sales');
    expect(kpi?.format).toBe('currency');
  });

  it('combo-table declares columnFormats.Sales: currency in YAML', () => {
    const table = rawConfig.tables.find((t) => t.id === 'combo-table');
    expect(table?.columnFormats?.Sales).toBe('currency');
  });
});
