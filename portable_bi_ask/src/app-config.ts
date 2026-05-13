import type { AskDataConfig, DashboardFilterConfig, DataSourceConfig } from './types';

export interface DefaultDashboardSeed {
  subtitle: string;
  dataSources: DataSourceConfig[];
  askData: Pick<AskDataConfig, 'defaultQuestion'>;
  filters: DashboardFilterConfig[];
}

export const APP_DEFAULT_DASHBOARD_SEED: DefaultDashboardSeed = {
  subtitle: '',
  dataSources: [],
  askData: { defaultQuestion: '' },
  filters: [],
};

export function createDefaultDashboardSeed(): DefaultDashboardSeed {
  return {
    subtitle: APP_DEFAULT_DASHBOARD_SEED.subtitle,
    dataSources: [...APP_DEFAULT_DASHBOARD_SEED.dataSources],
    askData: { ...APP_DEFAULT_DASHBOARD_SEED.askData },
    filters: [...APP_DEFAULT_DASHBOARD_SEED.filters],
  };
}
