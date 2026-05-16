import { DuckDBDataSourceManager } from '../../../infra/data-sources/data-source-manager';
import { duckDBManager } from '../../../infra/db/db';
import type { DashboardConfig, DataSourceConfig } from '../../../shared/types/index';
import { getDatasourceBySlug } from '../../datasource/data/datasource-registry';
import { AskDataEngine } from '../model/ask-data';
import { AskOrchestrator, type AskOrchestratorConfig } from './ask-orchestrator';

export function createDashboardOrchestrator(
  config: DashboardConfig,
  resolvedSources?: DataSourceConfig[],
): AskOrchestrator {
  const dsManager = new DuckDBDataSourceManager(duckDBManager);
  const dataSources =
    resolvedSources ??
    ((config.dataSourceSlugs ?? [])
      .map((s) => getDatasourceBySlug(s))
      .filter(Boolean) as DataSourceConfig[]);
  const orchestratorConfig: AskOrchestratorConfig = {
    dataSources,
    askData: config.askData,
    relationships: config.relationships,
  };
  return new AskOrchestrator(
    orchestratorConfig,
    dsManager,
    (cfg) => new AskDataEngine(cfg, duckDBManager),
  );
}
