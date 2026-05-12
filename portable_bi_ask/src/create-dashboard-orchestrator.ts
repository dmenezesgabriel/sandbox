import { AskDataEngine } from './ask-data';
import { AskOrchestrator, type AskOrchestratorConfig } from './ask-orchestrator';
import { DuckDBDataSourceManager } from './data-source-manager';
import { duckDBManager } from './db';
import type { DashboardConfig } from './types';

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
