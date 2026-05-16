import type { AskDataConfig, DashboardFilterConfig } from '../shared/types/index';

export interface DefaultDashboardSeed {
  subtitle: string;
  dataSourceSlugs: string[];
  askData: Pick<AskDataConfig, 'defaultQuestion'>;
  filters: DashboardFilterConfig[];
}

export const APP_DEFAULT_DASHBOARD_SEED: DefaultDashboardSeed = {
  subtitle: '',
  dataSourceSlugs: [],
  askData: { defaultQuestion: '' },
  filters: [],
};

export function createDefaultDashboardSeed(): DefaultDashboardSeed {
  return {
    subtitle: APP_DEFAULT_DASHBOARD_SEED.subtitle,
    dataSourceSlugs: [...APP_DEFAULT_DASHBOARD_SEED.dataSourceSlugs],
    askData: { ...APP_DEFAULT_DASHBOARD_SEED.askData },
    filters: [...APP_DEFAULT_DASHBOARD_SEED.filters],
  };
}
