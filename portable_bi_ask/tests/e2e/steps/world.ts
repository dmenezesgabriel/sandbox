import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
  setWorldConstructor,
} from '@cucumber/cucumber';

setDefaultTimeout(30000);
import { type ChildProcess, spawn } from 'child_process';
import path from 'path';
import { type Browser, chromium, type Page } from 'playwright';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;

export const TEST_SHEETS = [
  {
    id: 'sheet-a',
    name: 'Sales Overview',
    type: 'dashboard',
    widgets: [
      {
        id: 'w-chart-1',
        type: 'chart',
        title: 'Revenue by Region',
        query: 'show me sales by region',
        chartType: 'bar',
      },
      {
        id: 'w-chart-2',
        type: 'chart',
        title: 'Monthly Trend',
        query: 'show me monthly sales trend',
        chartType: 'line',
      },
    ],
    layout: [
      { x: 16, y: 16, w: 400, h: 240 },
      { x: 432, y: 16, w: 400, h: 240 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sheet-b',
    name: 'Category Analysis',
    type: 'dashboard',
    widgets: [
      {
        id: 'w-chart-3',
        type: 'chart',
        title: 'Category Breakdown',
        query: 'show me sales by category',
        chartType: 'pie',
      },
    ],
    layout: [{ x: 16, y: 16, w: 400, h: 300 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let server: ChildProcess | null = null;
let browser: Browser | null = null;

export class BrowserWorld {
  page!: Page;
  _expectedChartInitCount: number = 0;

  async navigate(urlPath: string = '/'): Promise<void> {
    await this.page.goto(`${BASE_URL}${urlPath}`);
  }

  async injectSheets(sheets: typeof TEST_SHEETS): Promise<void> {
    await this.page.evaluate((s) => {
      localStorage.setItem('sheets', JSON.stringify({ version: 3, data: s }));
    }, sheets);
  }

  async clearSheets(): Promise<void> {
    await this.page.evaluate(() => localStorage.removeItem('sheets'));
  }

  async hasEmptyState(): Promise<boolean> {
    return this.page.evaluate(() => !!document.querySelector('.sheet-empty'));
  }

  async hasNewSheetButton(): Promise<boolean> {
    return this.page.evaluate(() => !!document.querySelector('.btn-new-sheet'));
  }

  async clickNewSheet(): Promise<void> {
    await this.page.click('.btn-new-sheet');
  }

  async fillNewSheetName(name: string): Promise<void> {
    const input = this.page.locator('.modal-content input[type="text"]');
    await input.fill(name);
  }

  async clickCreate(): Promise<void> {
    await this.page.click('.btn-save');
  }

  async getSheetTabNames(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('.sheet-name')].map((el) => el.textContent ?? ''),
    );
  }

  async getWidgetCount(): Promise<number> {
    return this.page.evaluate(() => document.querySelectorAll('.widget-wrapper').length);
  }

  async getSelectedCount(): Promise<number> {
    return this.page.evaluate(() => document.querySelectorAll('.widget-wrapper.selected').length);
  }

  async clickWidgetContent(index: number = 0): Promise<void> {
    await this.page.evaluate((i) => {
      const el = document.querySelectorAll('.widget-content')[i];
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, index);
  }

  async isEditMode(): Promise<boolean> {
    return this.page.evaluate(
      () => document.querySelector('.widget-wrapper')?.classList.contains('edit-mode') ?? false,
    );
  }

  async clickEditToggle(): Promise<void> {
    await this.page.click('.btn-edit-mode');
  }

  async clickSheetTab(name: string): Promise<void> {
    const tab = this.page.locator('.sheet-tab', { hasText: name });
    await tab.click();
  }

  async getChartInitLogs(): Promise<number> {
    return this.page.evaluate(() => {
      const logs = (window as unknown as { __chartInitLogs?: string[] }).__chartInitLogs;
      return Array.isArray(logs) ? logs.length : -1;
    });
  }

  async installLogInterceptor(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as { __chartInitLogs: string[] };
      w.__chartInitLogs = [];
      const orig = console.log;
      console.log = (..._args: unknown[]) => {
        const msg = String(_args[0] ?? '');
        if (msg.includes('[widget] initializing chart')) {
          w.__chartInitLogs.push(msg);
        }
        orig.apply(console, _args);
      };
    });
  }

  async installAskSpy(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as { __askCallCount: number };
      w.__askCallCount = 0;
      const el = document.querySelector('sheets-view') as unknown as {
        _askEngine?: { ask: (...args: unknown[]) => Promise<unknown> };
      };
      if (el && el._askEngine) {
        el._askEngine.ask = async (..._args: unknown[]) => {
          w.__askCallCount = (w.__askCallCount || 0) + 1;
          return { rows: [{ label: 'Mock', value: 100 }], sql: 'SELECT 1', chartType: 'bar' };
        };
      }
    });
  }

  async waitForDataCache(sheetId: string): Promise<void> {
    await this.page.waitForFunction(
      (id: string) => {
        const el = document.querySelector('sheets-view') as unknown as {
          _dataCache?: Record<string, unknown>;
        };
        return el && el._dataCache && el._dataCache[id] !== undefined;
      },
      sheetId,
      { timeout: 15000 },
    );
  }

  async getAskCallCount(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __askCallCount?: number }).__askCallCount || 0,
    );
  }

  async waitForWidgets(): Promise<void> {
    await this.page.waitForSelector('.widget-wrapper', { timeout: 8000 }).catch(() => {});
  }

  async waitForCanvas(): Promise<void> {
    await this.page.waitForSelector('.sheet-canvas', { timeout: 8000 }).catch(() => {});
  }
}

setWorldConstructor(BrowserWorld);

BeforeAll(async () => {
  const npxPath =
    process.platform === 'win32'
      ? path.resolve(path.dirname(process.execPath), 'npx.cmd')
      : path.resolve(path.dirname(process.execPath), 'npx');
  // eslint-disable-next-line sonarjs/os-command
  server = spawn(npxPath, ['vite', '--port', String(PORT)], {
    cwd: path.resolve(__dirname, '../../..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite did not start')), 25000);
    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes('Local:') || text.includes('ready')) {
        clearTimeout(timeout);
        setTimeout(resolve, 1000);
      }
    };
    server!.stdout?.on('data', onData);
    server!.stderr?.on('data', onData);
  });

  browser = await chromium.launch({ headless: true });
});

Before(async function (this: BrowserWorld) {
  const context = await browser!.newContext({ viewport: { width: 1280, height: 900 } });
  this.page = await context.newPage();
});

After(async function (this: BrowserWorld) {
  if (this.page) {
    await this.page.context().close();
  }
});

AfterAll(async () => {
  if (browser) {
    await browser.close();
  }
  if (server) {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
  }
});
