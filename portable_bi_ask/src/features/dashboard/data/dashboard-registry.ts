import { parse as parseYaml } from 'yaml';

import type { DashboardConfig } from '../../../shared/types/index';
import { migrateDashboards } from '../../datasource/model/datasource-migration';
import portableBiDashboardYaml from './dashboards/portable-bi-dashboard.yaml?raw';

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface DashboardEntry {
  slug: string;
  config: DashboardConfig;
  source: 'yaml' | 'user';
}

const yamlModules: string[] = [portableBiDashboardYaml];

const staticEntries: DashboardEntry[] = yamlModules.map((yaml) => {
  const config = parseYaml(yaml) as DashboardConfig;
  const slug = titleToSlug(config.title);
  return { slug, config, source: 'yaml' };
});

const PERSIST_KEY = 'persisted_dashboards_v1';

function loadPersistedDashboards(): DashboardEntry[] {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ slug: string; config: DashboardConfig }>;
    const configs = parsed.map((p) => p.config);
    const migrated = migrateDashboards(configs);
    const changed = migrated.some((c, i) => c !== configs[i]);
    if (changed) {
      const toSave = parsed.map((p, i) => ({ slug: p.slug, config: migrated[i] }));
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(toSave));
      } catch {
        // localStorage may be unavailable in some environments; proceed without persisting
      }
    }
    return parsed.map((p, i) => ({ slug: p.slug, config: migrated[i], source: 'user' as const }));
  } catch {
    return [];
  }
}

function savePersistedDashboards(entries: DashboardEntry[]): void {
  try {
    const toSave = entries.map((e) => ({ slug: e.slug, config: e.config }));
    localStorage.setItem(PERSIST_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn('Failed to persist dashboards:', err);
  }
}

// Merge static YAML dashboards with persisted dashboards from localStorage.
const persistedEntries: DashboardEntry[] =
  typeof window !== 'undefined' ? loadPersistedDashboards() : [];

const entries: DashboardEntry[] = [...staticEntries, ...persistedEntries];

export const dashboardList: DashboardEntry[] = entries;

export const dashboardRegistry: Record<string, DashboardConfig> = Object.fromEntries(
  entries.map((e) => [e.slug, e.config]),
);

export function getDashboardBySlug(slug: string): DashboardConfig | undefined {
  return dashboardRegistry[slug];
}

export function addDashboard(config: DashboardConfig): string {
  // ensure unique slug
  const base = titleToSlug(config.title) || 'dashboard';
  let slug = base;
  let i = 1;
  while (dashboardRegistry[slug]) {
    slug = `${base}-${i++}`;
  }

  const entry: DashboardEntry = { slug, config, source: 'user' };

  dashboardList.push(entry);
  dashboardRegistry[slug] = entry.config;

  // only persist user-added dashboards (those not in staticEntries)
  const persistedOnly = dashboardList.filter((e) => e.source === 'user');
  savePersistedDashboards(persistedOnly);

  return slug;
}

export function deleteDashboard(slug: string): void {
  const idx = dashboardList.findIndex((e) => e.slug === slug);
  if (idx === -1) return;
  const entry = dashboardList[idx];
  if (entry.source === 'yaml') {
    console.warn(`Cannot delete YAML-seeded dashboard: "${slug}"`);
    return;
  }
  dashboardList.splice(idx, 1);
  delete dashboardRegistry[slug];
  const persistedOnly = dashboardList.filter((e) => e.source === 'user');
  savePersistedDashboards(persistedOnly);
}
