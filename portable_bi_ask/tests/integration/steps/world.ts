import { Before, setWorldConstructor } from '@cucumber/cucumber';

import { AskDataEngine } from '../../../src/features/ask/model/ask-data.ts';
import type { AskResult, CatalogField } from '../../../src/shared/types/index.ts';
import { setupTestDatabase, TEST_CONFIG } from '../../helpers/fixtures.ts';
import { NodeDuckDBManager } from '../../helpers/node-duckdb.ts';

export class AskWorld {
  db!: NodeDuckDBManager;
  engine!: AskDataEngine;
  result: AskResult | null = null;
  catalogBuildCount = 0;
  _catalogBuildCount: number | null = null;
  _catalogInstance: CatalogField[] | null = null;

  getEngine(): AskDataEngine {
    return this.engine;
  }
}

Before(async function (this: AskWorld) {
  this.db = new NodeDuckDBManager();
  await setupTestDatabase(this.db);
  this.engine = new AskDataEngine(TEST_CONFIG, this.db);

  const originalBuild = this.engine.catalogBuilder.build.bind(this.engine.catalogBuilder);
  this.engine.catalogBuilder.build = async () => {
    this.catalogBuildCount += 1;
    return originalBuild();
  };

  await this.engine.initialize();
});

setWorldConstructor(AskWorld);
