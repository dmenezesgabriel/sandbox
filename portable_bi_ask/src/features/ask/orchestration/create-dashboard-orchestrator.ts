import { DuckDBDataSourceManager } from '../../../infra/data-sources/data-source-manager';
import { duckDBManager } from '../../../infra/db/db';
import type { DashboardConfig } from '../../../shared/types/index';
import { AskDataEngine } from '../model/ask-data';
import { AskOrchestrator, type AskOrchestratorConfig } from './ask-orchestrator';

export function createDashboardOrchestrator(config: DashboardConfig): AskOrchestrator {
  const dsManager = new DuckDBDataSourceManager(duckDBManager);
  const orchestratorConfig: AskOrchestratorConfig = {
    dataSources: config.dataSources,
    askData: config.askData,
    relationships: config.relationships,
  };
  return new AskOrchestrator(
    orchestratorConfig,
    dsManager,
    (cfg) => new AskDataEngine(cfg, duckDBManager),
  );
}
