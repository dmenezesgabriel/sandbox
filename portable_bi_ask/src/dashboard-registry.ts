import { parse as parseYaml } from 'yaml';

import portableBiDashboardYaml from './dashboards/portable-bi-dashboard.yaml?raw';
import type { DashboardConfig } from './types';

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function processConfig(raw: DashboardConfig): DashboardConfig {
  return {
    ...raw,
    kpis: raw.kpis.map((kpi, i) => (i === 0 ? { ...kpi, format: 'currency' as const } : kpi)),
    tables: raw.tables.map((table, i) =>
      i === 0 ? { ...table, columnFormats: { Sales: 'currency' as const } } : table,
    ),
  };
}

interface DashboardEntry {
  slug: string;
  config: DashboardConfig;
}

const yamlModules: string[] = [portableBiDashboardYaml];

const entries: DashboardEntry[] = yamlModules.map((yaml) => {
  const raw = parseYaml(yaml) as DashboardConfig;
  const config = processConfig(raw);
  const slug = titleToSlug(config.title);
  return { slug, config };
});

export const dashboardList: DashboardEntry[] = entries;

export const dashboardRegistry: Record<string, DashboardConfig> = Object.fromEntries(
  entries.map((e) => [e.slug, e.config]),
);

export function getDashboardBySlug(slug: string): DashboardConfig | undefined {
  return dashboardRegistry[slug];
}
