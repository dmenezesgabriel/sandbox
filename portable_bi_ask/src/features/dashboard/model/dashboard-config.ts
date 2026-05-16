import { createDefaultDashboardSeed } from '../../../app/app-config';
import type { DashboardConfig } from '../../../shared/types/index';

export function createEmptyDashboardConfig(title = 'New Dashboard'): DashboardConfig {
  const seed = createDefaultDashboardSeed();
  return {
    title,
    subtitle: seed.subtitle,
    dataSourceSlugs: seed.dataSourceSlugs,
    askData: seed.askData,
    filters: seed.filters,
    kpis: [],
    charts: [],
    tables: [],
    layout: [],
    relationships: [],
  };
}

// Default used when rendering a new dashboard before the user has saved anything.
export const DASHBOARD_CONFIG: DashboardConfig = createEmptyDashboardConfig('New Dashboard');
