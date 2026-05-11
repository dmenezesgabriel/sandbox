import { parse as parseYaml } from 'yaml';

import dashboardYaml from './dashboard.yaml?raw';
import type { DashboardConfig } from './types';

const _data = parseYaml(dashboardYaml) as DashboardConfig;

export const DASHBOARD_CONFIG: DashboardConfig = {
  ..._data,
  kpis: _data.kpis.map((kpi, i) => (i === 0 ? { ...kpi, format: 'currency' as const } : kpi)),
  tables: _data.tables.map((table, i) =>
    i === 0 ? { ...table, columnFormats: { Sales: 'currency' as const } } : table,
  ),
};
