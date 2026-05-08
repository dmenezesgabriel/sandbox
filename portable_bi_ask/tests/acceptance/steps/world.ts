import { setWorldConstructor, BeforeAll } from '@cucumber/cucumber';
import { AskDataEngine } from '../../../src/ask-data.ts';
import { NodeDuckDBManager } from '../../support/node-duckdb.ts';
import { TEST_CONFIG, setupTestDatabase } from '../../support/fixtures.ts';
import type { AskResult } from '../../../src/types.ts';

// Shared engine created once before all scenarios.
let sharedDb: NodeDuckDBManager;
let sharedEngine: AskDataEngine;

BeforeAll(async () => {
  sharedDb = new NodeDuckDBManager();
  await setupTestDatabase(sharedDb);
  sharedEngine = new AskDataEngine(TEST_CONFIG, sharedDb);
  await sharedEngine.initialize();
});

export class AskWorld {
  engine!: AskDataEngine;
  result: AskResult | null = null;

  getEngine(): AskDataEngine {
    return sharedEngine;
  }
}

setWorldConstructor(AskWorld);
