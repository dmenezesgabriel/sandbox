import { dashboardList } from './dashboard-registry';
import type { DashboardConfig } from './types';

export const DASHBOARD_CONFIG: DashboardConfig = dashboardList[0].config;
