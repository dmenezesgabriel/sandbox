import { dashboardList } from './dashboard-registry';
import type { DashboardConfig } from './types';

export function createEmptyDashboardConfig(title = 'New Dashboard'): DashboardConfig {
  // Use dataSources, askData and filters from the first static dashboard (if available)
  // so the AskData engine has data to work with while the new dashboard starts empty.
  const base = dashboardList[0]?.config;
  return {
    title,
    subtitle: '',
    dataSources: base?.dataSources ?? [],
    askData: base?.askData ?? { defaultQuestion: '' },
    filters: base?.filters ?? [],
    kpis: [],
    charts: [],
    tables: [],
    layout: [],
    relationships: [],
  };
}

// Default used when rendering a new dashboard before the user has saved anything.
export const DASHBOARD_CONFIG: DashboardConfig = createEmptyDashboardConfig('New Dashboard');
