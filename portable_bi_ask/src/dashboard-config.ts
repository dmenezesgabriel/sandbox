import { parse as parseYaml } from 'yaml';

import dashboardYaml from './dashboard.yaml?raw';
import type { CellValue, DashboardConfig } from './types';

const _data = parseYaml(dashboardYaml) as DashboardConfig;

const _formatCurrency = (v: CellValue): string => '$' + Math.round(Number(v || 0)).toLocaleString();

export const DASHBOARD_CONFIG: DashboardConfig = {
  ..._data,
  kpis: _data.kpis.map((kpi, i) => (i === 0 ? { ...kpi, format: _formatCurrency } : kpi)),
  tables: _data.tables.map((table, i) =>
    i === 0 ? { ...table, columnFormats: { Sales: _formatCurrency } } : table,
  ),
};
