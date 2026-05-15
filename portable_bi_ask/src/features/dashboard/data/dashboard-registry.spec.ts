import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import type { DashboardConfig } from '../../../shared/types/index';
import { createEmptyDashboardConfig } from '../model/dashboard-config';
import { dashboardRegistry, titleToSlug } from './dashboard-registry';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawYaml = readFileSync(resolve(__dirname, './dashboards/portable-bi-dashboard.yaml'), 'utf8');
const PERSIST_KEY = 'persisted_dashboards_v1';

type DashboardRegistryModule = typeof import('./dashboard-registry');
type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createLocalStorageMock(seed: Record<string, string> = {}): {
  store: Map<string, string>;
  localStorage: LocalStorageMock;
} {
  const store = new Map(Object.entries(seed));

  return {
    store,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  };
}

async function importFreshDashboardRegistry(
  localStorage: LocalStorageMock,
): Promise<DashboardRegistryModule> {
  vi.resetModules();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', localStorage);
  return import('./dashboard-registry');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

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

describe('dashboard-registry: persistence contract', () => {
  it('generates unique slugs for duplicate titles and resolves static and added dashboards', async () => {
    const { localStorage } = createLocalStorageMock();
    const { addDashboard, getDashboardBySlug } = await importFreshDashboardRegistry(localStorage);

    const first = createEmptyDashboardConfig('Executive Overview');
    const second = createEmptyDashboardConfig('Executive Overview');

    expect(addDashboard(first)).toBe('executive-overview');
    expect(addDashboard(second)).toBe('executive-overview-1');

    expect(getDashboardBySlug('portable-bi-dashboard')).toEqual(
      dashboardRegistry['portable-bi-dashboard'],
    );
    expect(getDashboardBySlug('executive-overview')).toBe(first);
    expect(getDashboardBySlug('executive-overview-1')).toBe(second);
  });

  it('persists added dashboards through a localStorage-backed reload', async () => {
    const storage = createLocalStorageMock();
    const firstLoad = await importFreshDashboardRegistry(storage.localStorage);
    const created = createEmptyDashboardConfig('Customer Health');

    expect(firstLoad.addDashboard(created)).toBe('customer-health');
    expect(storage.store.get(PERSIST_KEY)).toBeDefined();

    const secondLoad = await importFreshDashboardRegistry(storage.localStorage);

    expect(secondLoad.getDashboardBySlug('portable-bi-dashboard')).toBeDefined();
    expect(secondLoad.getDashboardBySlug('customer-health')).toEqual(created);
  });

  it('falls back to the static list when persisted JSON is corrupt', async () => {
    const baseline = createLocalStorageMock();
    const fresh = await importFreshDashboardRegistry(baseline.localStorage);
    const baselineSlugs = fresh.dashboardList.map((entry) => entry.slug);

    const corrupt = createLocalStorageMock({ [PERSIST_KEY]: '{not valid json' });
    const loaded = await importFreshDashboardRegistry(corrupt.localStorage);

    expect(loaded.dashboardList.map((entry) => entry.slug)).toEqual(baselineSlugs);
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
