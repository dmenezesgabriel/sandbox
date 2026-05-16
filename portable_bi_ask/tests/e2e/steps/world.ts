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

// Simple SQL queries so charts render without needing external datasources or NL engine
const SIMPLE_BAR_QUERY =
  "SELECT 'North' AS label, 420 AS value UNION ALL SELECT 'South', 310 UNION ALL SELECT 'East', 280";
const SIMPLE_LINE_QUERY =
  "SELECT 'Jan' AS label, 100 AS value UNION ALL SELECT 'Feb', 140 UNION ALL SELECT 'Mar', 120";
const SIMPLE_PIE_QUERY =
  "SELECT 'Furniture' AS label, 40 AS value UNION ALL SELECT 'Tech', 35 UNION ALL SELECT 'Office', 25";

export const TEST_DASHBOARDS = [
  {
    id: 'sheet-a',
    name: 'Sales Overview',
    type: 'dashboard',
    widgets: [
      {
        id: 'w-chart-1',
        type: 'chart',
        title: 'Revenue by Region',
        queryType: 'sql',
        query: SIMPLE_BAR_QUERY,
        chartType: 'bar',
      },
      {
        id: 'w-chart-2',
        type: 'chart',
        title: 'Monthly Trend',
        queryType: 'sql',
        query: SIMPLE_LINE_QUERY,
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
        queryType: 'sql',
        query: SIMPLE_PIE_QUERY,
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
  _pageErrors: string[] = [];
  _consoleErrors: string[] = [];
  _lastQuestionSlug = '';

  async navigate(urlPath: string = '/'): Promise<void> {
    await this.page.goto(`${BASE_URL}${urlPath}`);
  }

  async injectDashboards(
    sheets: typeof TEST_DASHBOARDS,
    slug: string = 'portable-bi-dashboard',
  ): Promise<void> {
    await this.page.evaluate(
      ({ s, slug: sl }) => {
        localStorage.setItem(`dashboard:${sl}`, JSON.stringify({ version: 3, data: s }));
      },
      { s: sheets, slug },
    );
  }

  async clearDashboards(slug: string = 'portable-bi-dashboard'): Promise<void> {
    await this.page.evaluate((sl) => localStorage.removeItem(`dashboard:${sl}`), slug);
  }

  async hasEmptyState(): Promise<boolean> {
    return this.page.evaluate(() => !!document.querySelector('.dashboard-empty'));
  }

  async hasNewDashboardButton(): Promise<boolean> {
    return this.page.evaluate(() => !!document.querySelector('.btn-new-dashboard'));
  }

  async clickNewDashboard(): Promise<void> {
    await this.page.click('.btn-new-dashboard');
  }

  async fillNewDashboardName(name: string): Promise<void> {
    const input = this.page.locator('.modal-content input[type="text"]');
    await input.fill(name);
  }

  async clickCreate(): Promise<void> {
    await this.page.click('.btn-save');
  }

  async getDashboardTabNames(): Promise<string[]> {
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
    await this.page.click('.editor-edit-btn');
  }

  async clickDashboardTab(name: string): Promise<void> {
    const tab = this.page.locator('.sheet-tab', { hasText: name });
    await tab.click();
  }

  async getChartInitLogs(): Promise<number> {
    return this.page.evaluate(() => {
      const logs = (window as unknown as { __chartInitLogs?: string[] }).__chartInitLogs;
      return Array.isArray(logs) ? logs.length : -1;
    });
  }

  async getChartInitErrors(): Promise<string[]> {
    const interceptedErrors = await this.page.evaluate(() => {
      const errors = (window as unknown as { __chartInitErrors?: string[] }).__chartInitErrors;
      return Array.isArray(errors) ? [...errors] : [];
    });
    const all = [...new Set([...this._pageErrors, ...this._consoleErrors, ...interceptedErrors])];
    // Filter DuckDB internal log noise captured by the console interceptor
    return all.filter(
      (e) => !e.includes('duckdb') && !e.includes('timestamp') && !e.includes('Fri '),
    );
  }

  async getRenderedChartCount(): Promise<number> {
    return this.page.evaluate(
      () => document.querySelectorAll('.widget-chart-container canvas').length,
    );
  }

  async waitForChartInitialization(): Promise<void> {
    // DuckDB-WASM can take up to 60 s to initialize; wait for canvas or hard errors
    await this.page.waitForFunction(
      () => {
        const w = window as unknown as {
          __chartInitLogs?: string[];
          __chartInitErrors?: string[];
        };
        const initCount = Array.isArray(w.__chartInitLogs) ? w.__chartInitLogs.length : 0;
        const errors = Array.isArray(w.__chartInitErrors) ? w.__chartInitErrors : [];
        // Ignore DuckDB internal log noise (not real errors)
        const hardErrors = errors.filter(
          (e) => !e.includes('duckdb') && !e.includes('timestamp') && !e.includes('Fri '),
        );
        const canvasCount = document.querySelectorAll('.widget-chart-container canvas').length;
        return hardErrors.length > 0 || (canvasCount > 0 && initCount >= canvasCount);
      },
      undefined,
      { timeout: 60000 },
    );
  }

  async installLogInterceptor(): Promise<void> {
    this._pageErrors = [];
    this._consoleErrors = [];

    await this.page.evaluate(() => {
      const w = window as unknown as {
        __chartInitLogs?: string[];
        __chartInitErrors?: string[];
        __chartInitInterceptorInstalled?: boolean;
      };

      w.__chartInitLogs = [];
      w.__chartInitErrors = [];

      if (w.__chartInitInterceptorInstalled) {
        return;
      }
      w.__chartInitInterceptorInstalled = true;

      const origLog = console.log.bind(console);
      const origError = console.error.bind(console);

      console.log = (...args: unknown[]) => {
        const msg = args.map((arg) => String(arg)).join(' ');
        if (msg.includes('[widget] initializing chart')) {
          w.__chartInitLogs?.push(msg);
        }
        origLog(...args);
      };

      console.error = (...args: unknown[]) => {
        const msg = args.map((arg) => String(arg)).join(' ');
        w.__chartInitErrors?.push(msg);
        origError(...args);
      };

      window.addEventListener('error', (event) => {
        const msg = String(event.error?.message ?? event.message ?? 'Unknown error');
        w.__chartInitErrors?.push(msg);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const msg = String(event.reason?.message ?? event.reason ?? 'Unhandled rejection');
        w.__chartInitErrors?.push(msg);
      });
    });
  }

  async installDashboardWorkspaceProbe(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as {
        __dashboardsViewProbeInstalled?: boolean;
        __askCallCount?: number;
        __loadedDashboardIds?: string[];
      };

      w.__askCallCount = 0;
      w.__loadedDashboardIds = [];

      if (w.__dashboardsViewProbeInstalled) {
        return;
      }
      w.__dashboardsViewProbeInstalled = true;

      document.addEventListener('dashboard-ask', () => {
        w.__askCallCount = (w.__askCallCount || 0) + 1;
      });

      document.addEventListener('dashboard-data-loaded', (event) => {
        const detail = (event as CustomEvent<{ dashboardId?: string }>).detail;
        if (detail?.dashboardId) {
          w.__loadedDashboardIds?.push(detail.dashboardId);
        }
      });
    });
  }

  async waitForDashboardDataLoaded(dashboardId: string): Promise<void> {
    await this.page.waitForFunction(
      (id: string) => {
        const loadedDashboardIds = (window as unknown as { __loadedDashboardIds?: string[] })
          .__loadedDashboardIds;
        return Array.isArray(loadedDashboardIds) && loadedDashboardIds.includes(id);
      },
      dashboardId,
      { timeout: 15000 },
    );
  }

  async resetAskCallCount(): Promise<void> {
    await this.page.evaluate(() => {
      (window as unknown as { __askCallCount?: number }).__askCallCount = 0;
    });
  }

  async getAskCallCount(): Promise<number> {
    return this.page.evaluate(
      () => (window as unknown as { __askCallCount?: number }).__askCallCount || 0,
    );
  }

  async waitForWidgets(): Promise<void> {
    try {
      await this.page.waitForSelector('.widget-wrapper', { timeout: 8000 });
    } catch (error) {
      throw new Error(
        'Timed out waiting for .widget-wrapper to appear. Widget rendering is a required precondition for this scenario.',
        { cause: error },
      );
    }
  }

  async waitForCanvas(): Promise<void> {
    await this.page.waitForSelector('.dashboard-canvas', { timeout: 8000 }).catch(() => {});
  }

  async navigateToHash(hash: string): Promise<void> {
    await this.page.evaluate((h) => {
      window.location.hash = h;
    }, hash);
    await this.page.waitForTimeout(300);
  }

  async injectUserQuestion(title: string): Promise<void> {
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'question';
    const now = new Date().toISOString();
    const question = {
      id: slug,
      slug,
      title,
      type: 'chart',
      source: 'user',
      createdAt: now,
      updatedAt: now,
      query: '',
      dataSources: [],
    };
    await this.page.evaluate(
      ({ key, q }: { key: string; q: Record<string, unknown> }) => {
        const existing: unknown[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        existing.push(q);
        localStorage.setItem(key, JSON.stringify(existing));
      },
      { key: 'persisted_questions_v1', q: question as Record<string, unknown> },
    );
    this._lastQuestionSlug = slug;
  }

  async getQuestionCardTitles(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('question-list .collection-list-row-title')].map(
        (el) => el.textContent?.trim() ?? '',
      ),
    );
  }

  async hasDeleteButtonForCard(title: string): Promise<boolean> {
    return this.page.evaluate((t) => {
      const rows = [...document.querySelectorAll('question-list .collection-list-row')];
      const row = rows.find(
        (r) => r.querySelector('.collection-list-row-title')?.textContent?.trim() === t,
      );
      const btn = row?.querySelector<HTMLButtonElement>('.collection-action-btn.delete');
      return !!btn && !btn.disabled;
    }, title);
  }

  // ── Datasource helpers ──────────────────────────────────────────────────────

  _lastDatasourceSlug = '';

  async getDatasourceListNames(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('datasource-list .collection-list-row-title')].map(
        (el) => el.textContent?.trim() ?? '',
      ),
    );
  }

  async injectUserDatasource(name: string, url = 'https://example.com/data.csv'): Promise<void> {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'datasource';
    const now = new Date().toISOString();
    const ds = {
      id: slug,
      slug,
      name,
      description: '',
      type: 'csv',
      url,
      source: 'user',
      createdAt: now,
      updatedAt: now,
    };
    await this.page.evaluate(
      ({ key, d }: { key: string; d: Record<string, unknown> }) => {
        const existing: unknown[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        existing.push(d);
        localStorage.setItem(key, JSON.stringify(existing));
      },
      { key: 'persisted_datasources_v1', d: ds as Record<string, unknown> },
    );
    this._lastDatasourceSlug = slug;
  }

  async deleteDatasourceFromList(name: string): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.evaluate((n) => {
      const rows = [...document.querySelectorAll('datasource-list .collection-list-row')];
      const row = rows.find(
        (r) => r.querySelector('.collection-list-row-title')?.textContent?.trim() === n,
      );
      const btn = row?.querySelector<HTMLButtonElement>('.collection-action-btn.delete');
      if (btn) btn.click();
    }, name);
    await this.page.waitForTimeout(300);
  }

  async injectLegacyQuestion(url: string): Promise<void> {
    const now = new Date().toISOString();
    const q = {
      id: 'legacy-q',
      slug: 'legacy-q',
      title: 'Legacy Question',
      type: 'chart',
      source: 'user',
      createdAt: now,
      updatedAt: now,
      query: `SELECT * FROM data LIMIT 5`,
      dataSources: [{ url, type: 'csv' }],
    };
    await this.page.evaluate(
      ({ key, q: question }: { key: string; q: Record<string, unknown> }) => {
        const existing: unknown[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        existing.push(question);
        localStorage.setItem(key, JSON.stringify(existing));
      },
      { key: 'persisted_questions_v1', q: q as Record<string, unknown> },
    );
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
  this._pageErrors = [];
  this._consoleErrors = [];
  this.page.on('pageerror', (error) => {
    this._pageErrors.push(error.message);
  });
  this.page.on('console', (message) => {
    if (message.type() === 'error') {
      this._consoleErrors.push(message.text());
    }
  });
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
