import type {
  DataSourceEntry,
  DataSourceManager,
} from '../../../infra/data-sources/data-source-manager';
import type {
  AskResult,
  Clarification,
  DashboardConfig,
  ParseOptions,
} from '../../../shared/types/index';

export interface AskEngine {
  initialize(): Promise<void>;
  ask(question: string, options?: ParseOptions): Promise<AskResult>;
}

export interface AskOrchestratorConfig {
  dataSources: DataSourceEntry[];
  askData: DashboardConfig['askData'];
  relationships?: DashboardConfig['relationships'];
}

export class AskOrchestrator {
  private config: AskOrchestratorConfig;
  private dataSourceManager: DataSourceManager;
  private engine: AskEngine | null = null;
  private engineFactory: (config: AskOrchestratorConfig) => AskEngine;
  private initialized = false;

  constructor(
    config: AskOrchestratorConfig,
    dataSourceManager: DataSourceManager,
    engineFactory: (config: AskOrchestratorConfig) => AskEngine,
  ) {
    this.config = config;
    this.dataSourceManager = dataSourceManager;
    this.engineFactory = engineFactory;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.engine) {
      this.engine = this.engineFactory(this.config);
    }
    await this.dataSourceManager.createViews(this.config.dataSources);
    await this.engine.initialize();
    this.initialized = true;
  }

  async ask(
    question: string,
    options?: { clarification?: Clarification['pending'] },
  ): Promise<AskResult> {
    await this.initialize();
    if (!this.engine) throw new Error('Engine not initialized');
    return this.engine.ask(question, options ?? {});
  }
}
