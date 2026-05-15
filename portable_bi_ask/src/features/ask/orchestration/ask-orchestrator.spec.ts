import { describe, expect, it, vi } from 'vitest';

import type { DataSourceManager } from '../../../infra/data-sources/data-source-manager';
import type { AskSuccessResult, Clarification, DashboardConfig } from '../../../shared/types/index';
import { type AskEngine, AskOrchestrator } from './ask-orchestrator';

function makeMockEngine(
  overrides?: Partial<{ ask: () => Promise<AskSuccessResult>; initialize: () => Promise<void> }>,
): AskEngine {
  const successResult: AskSuccessResult = {
    question: 'test',
    interpretation: 'test',
    intent: {} as AskSuccessResult['intent'],
    sql: 'SELECT 1',
    rows: [],
    columns: [],
    shape: {} as AskSuccessResult['shape'],
    diagnostics: {},
    chartDecision: {} as AskSuccessResult['chartDecision'],
    insights: [],
    evidence: [],
    chartType: 'table',
    warnings: [],
    confidence: 1,
    metrics: { catalogBuildMs: 0 },
  };
  return {
    initialize: vi.fn(overrides?.initialize ?? (async () => {})),
    ask: vi.fn(overrides?.ask ?? (async () => successResult)),
  };
}

function makeMockDataSourceManager(): DataSourceManager {
  return {
    createViews: vi.fn(async () => {}),
  };
}

const config = {
  dataSources: [{ name: 'sales', url: 'https://example.com/sales.csv' }],
  askData: { defaultQuestion: 'show sales', locale: 'en-US' } as DashboardConfig['askData'],
  relationships: [],
};

describe('AskOrchestrator', () => {
  describe('initialize', () => {
    it('creates views and initializes the engine on first call', async () => {
      const mockEngine = makeMockEngine();
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => mockEngine);
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      await orchestrator.initialize();

      expect(mockDSManager.createViews).toHaveBeenCalledWith(config.dataSources);
      expect(mockEngine.initialize).toHaveBeenCalled();
    });

    it('is idempotent - second call does not re-create views or re-initialize engine', async () => {
      const mockEngine = makeMockEngine();
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => mockEngine);
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      await orchestrator.initialize();
      await orchestrator.initialize();

      expect(mockDSManager.createViews).toHaveBeenCalledTimes(1);
      expect(mockEngine.initialize).toHaveBeenCalledTimes(1);
    });

    it('does not create engine until initialize is called', () => {
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => makeMockEngine());
      const _orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);
      expect(_orchestrator).toBeTruthy();

      expect(createEngine).not.toHaveBeenCalled();
    });

    it('propagates view creation errors', async () => {
      const mockDSManager: DataSourceManager = {
        createViews: vi.fn(async () => {
          throw new Error('view creation failed');
        }),
      };
      const createEngine = vi.fn(() => makeMockEngine());
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      await expect(orchestrator.initialize()).rejects.toThrow('view creation failed');
    });

    it('propagates engine initialization errors', async () => {
      const mockEngine = makeMockEngine({
        initialize: vi.fn(async () => {
          throw new Error('engine init failed');
        }),
      });
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => mockEngine);
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      await expect(orchestrator.initialize()).rejects.toThrow('engine init failed');
    });
  });

  describe('ask', () => {
    it('auto-initializes before asking a question', async () => {
      const mockEngine = makeMockEngine();
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => mockEngine);
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      await orchestrator.ask('show sales');

      expect(mockDSManager.createViews).toHaveBeenCalled();
      expect(mockEngine.initialize).toHaveBeenCalled();
      expect(mockEngine.ask).toHaveBeenCalledWith('show sales', {});
    });

    it('passes clarification option to the engine', async () => {
      const mockEngine = makeMockEngine();
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => mockEngine);
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      const clarification: Clarification['pending'] = {
        slot: 'field',
        originalQuestion: null,
        fieldId: 'sales::Sales',
      };
      await orchestrator.ask('show sales', { clarification });

      expect(mockEngine.ask).toHaveBeenCalledWith('show sales', { clarification });
    });
  });

  describe('engine factory', () => {
    it('creates engine lazily on first initialize', async () => {
      const mockEngine = makeMockEngine();
      const mockDSManager = makeMockDataSourceManager();
      const createEngine = vi.fn(() => mockEngine);
      const orchestrator = new AskOrchestrator(config, mockDSManager, createEngine);

      expect(createEngine).not.toHaveBeenCalled();
      await orchestrator.initialize();
      expect(createEngine).toHaveBeenCalledWith(config);
    });
  });
});
