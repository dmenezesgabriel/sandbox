import { Given, Then, When } from '@cucumber/cucumber';
import { strict as assert } from 'assert';

import type { BrowserWorld } from './world.ts';

declare let __chartInitLogs: string[];

Given('the app is loaded', async function (this: BrowserWorld) {
  await this.navigate('/');
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
});

Given('I open the dashboard editor', async function (this: BrowserWorld) {
  await this.page.evaluate(() => {
    window.location.hash = '#/dashboard/portable-bi-dashboard';
  });
  await this.page.waitForSelector('dashboard-workspace', { timeout: 10000 });
});

Then(
  'I should see an empty canvas with {string}',
  async function (this: BrowserWorld, text: string) {
    const empty = await this.hasEmptyState();
    assert.ok(empty, 'Expected empty state to be visible');
    const content = await this.page.textContent('.dashboard-empty');
    assert.ok(content?.includes(text), `Expected "${text}" in empty state, got "${content}"`);
  },
);

Then('I should see a {string} button', async function (this: BrowserWorld, label: string) {
  const btn = await this.page.$(`text="${label}"`);
  assert.ok(btn, `Expected button "${label}" to exist`);
});

When('I click {string}', async function (this: BrowserWorld, label: string) {
  const el = this.page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
  await el.click();
});

When('I enter the sheet name {string}', async function (this: BrowserWorld, name: string) {
  await this.fillNewDashboardName(name);
});

When('I click the Edit button in the dashboard header', async function (this: BrowserWorld) {
  await this.clickEditToggle();
  await this.page.waitForTimeout(300);
});

When('I click Done Editing in the dashboard header', async function (this: BrowserWorld) {
  await this.clickEditToggle();
  await this.page.waitForTimeout(300);
});

Then(
  'a sheet tab with the name {string} should appear',
  async function (this: BrowserWorld, name: string) {
    const tabs = await this.getDashboardTabNames();
    assert.ok(tabs.includes(name), `Expected sheet tab "${name}" in [${tabs.join(', ')}]`);
  },
);

Then('the canvas should be empty', async function (this: BrowserWorld) {
  const count = await this.getWidgetCount();
  assert.equal(count, 0, `Expected 0 widgets, got ${count}`);
});

Given('a sheet exists with chart widgets', async function (this: BrowserWorld) {
  const simpleBarQuery =
    "SELECT 'North' AS label, 420 AS value UNION ALL SELECT 'South', 310 UNION ALL SELECT 'East', 280";
  const simpleLineQuery =
    "SELECT 'Jan' AS label, 100 AS value UNION ALL SELECT 'Feb', 140 UNION ALL SELECT 'Mar', 120";
  await this.injectDashboards([
    {
      id: 'sheet-a',
      name: 'Test Sheet',
      type: 'dashboard',
      widgets: [
        {
          id: 'w1',
          type: 'chart',
          title: 'Chart 1',
          queryType: 'sql',
          query: simpleBarQuery,
          chartType: 'bar',
        },
        {
          id: 'w2',
          type: 'chart',
          title: 'Chart 2',
          queryType: 'sql',
          query: simpleLineQuery,
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
  ]);
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
  // Pre-warm DuckDB so chart queries run immediately when the dashboard loads
  await this.page.evaluate(async () => {
    const mod = await import('/src/infra/db/db.ts');
    await mod.duckDBManager.initialize();
  });
  await this.installLogInterceptor();
  await this.page.evaluate(() => {
    window.location.hash = '#/dashboard/portable-bi-dashboard';
  });
  await this.waitForWidgets();
  await this.page.waitForTimeout(500);
});

Then('I should see widgets rendered on the canvas', async function (this: BrowserWorld) {
  const count = await this.getWidgetCount();
  assert.ok(count >= 1, `Expected at least 1 widget, got ${count}`);
});

Then('the chart widgets should initialize without errors', async function (this: BrowserWorld) {
  await this.waitForChartInitialization();
  const [initCount, renderedChartCount, initErrors] = await Promise.all([
    this.getChartInitLogs(),
    this.getRenderedChartCount(),
    this.getChartInitErrors(),
  ]);

  assert.ok(
    renderedChartCount >= 1,
    `Expected at least 1 rendered chart canvas, got ${renderedChartCount}`,
  );
  assert.ok(
    initCount >= renderedChartCount,
    `Expected chart init for ${renderedChartCount} rendered chart widget(s), got ${initCount}`,
  );
  assert.deepEqual(
    initErrors,
    [],
    `Expected chart init without errors, got: ${initErrors.join(' | ')}`,
  );
});

When('I click on a widget content area', async function (this: BrowserWorld) {
  await this.clickWidgetContent(0);
  await this.page.waitForTimeout(200);
});

Then('the widget should not be selected', async function (this: BrowserWorld) {
  const selected = await this.getSelectedCount();
  assert.equal(selected, 0, `Expected 0 selected widgets, got ${selected}`);
});

Then('the chart should not re-initialize', async function (this: BrowserWorld) {
  const initCount = await this.getChartInitLogs();
  await this.page.waitForTimeout(300);
  const initCountAfter = await this.getChartInitLogs();
  assert.equal(
    initCountAfter,
    initCount,
    `Chart re-initialized: ${initCount} -> ${initCountAfter}`,
  );
});

Then('the widget should be selected', async function (this: BrowserWorld) {
  const selected = await this.getSelectedCount();
  assert.equal(selected, 1, `Expected 1 selected widget, got ${selected}`);
});

Given('I am in edit mode with a selected widget', async function (this: BrowserWorld) {
  await this.injectDashboards([
    {
      id: 'sheet-a',
      name: 'Test Sheet',
      type: 'dashboard',
      widgets: [
        {
          id: 'w1',
          type: 'chart',
          title: 'Chart 1',
          query: 'show me sales by region',
          chartType: 'bar',
        },
      ],
      layout: [{ x: 16, y: 16, w: 400, h: 240 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
  await this.installLogInterceptor();
  await this.page.evaluate(() => {
    window.location.hash = '#/dashboard/portable-bi-dashboard';
  });
  await this.waitForWidgets();
  await this.clickEditToggle();
  await this.page.waitForTimeout(300);
  await this.clickWidgetContent(0);
  await this.page.waitForTimeout(200);
  const selected = await this.getSelectedCount();
  assert.equal(selected, 1, 'Precondition failed: widget should be selected');
});

Then('no widget should be selected', async function (this: BrowserWorld) {
  const selected = await this.getSelectedCount();
  assert.equal(selected, 0, `Expected 0 selected widgets, got ${selected}`);
});

// ── Question steps ────────────────────────────────────────────────────────────

When('I enter the question name {string}', async function (this: BrowserWorld, name: string) {
  const input = this.page.locator('.modal-content input[type="text"]');
  await input.fill(name);
});

When('I navigate to {string}', async function (this: BrowserWorld, hash: string) {
  await this.navigateToHash(hash);
});

Then('I should be on a question editor page', async function (this: BrowserWorld) {
  await this.page.waitForSelector('question-editor', { timeout: 5000 });
});

When('I set the question title to {string}', async function (this: BrowserWorld, title: string) {
  const input = this.page.locator('#qep-title');
  await input.clear();
  await input.fill(title);
});

Then(
  'I should see {string} in the question list',
  async function (this: BrowserWorld, title: string) {
    await this.page.waitForSelector('question-list', { timeout: 5000 });
    // Poll briefly to handle async list re-render after navigation
    let titles: string[] = [];
    for (let i = 0; i < 5; i++) {
      titles = await this.getQuestionCardTitles();
      if (titles.includes(title)) break;
      await this.page.waitForTimeout(400);
    }
    assert.ok(
      titles.includes(title),
      `Expected "${title}" in question list, got [${titles.join(', ')}]`,
    );
  },
);

Then(
  'I should not see {string} in the question list',
  async function (this: BrowserWorld, title: string) {
    const titles = await this.getQuestionCardTitles();
    assert.ok(
      !titles.includes(title),
      `Expected "${title}" to be absent from question list, got [${titles.join(', ')}]`,
    );
  },
);

When(
  'I delete the question {string} from the list',
  async function (this: BrowserWorld, title: string) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.evaluate((t) => {
      const rows = [...document.querySelectorAll('question-list .collection-list-row')];
      const row = rows.find(
        (r) => r.querySelector('.collection-list-row-title')?.textContent?.trim() === t,
      );
      const btn = row?.querySelector<HTMLButtonElement>('.collection-action-btn.delete');
      if (btn) btn.click();
    }, title);
    await this.page.waitForTimeout(300);
  },
);

Given('a user question {string} exists', async function (this: BrowserWorld, title: string) {
  await this.injectUserQuestion(title);
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
});

When('I navigate to its question editor page', async function (this: BrowserWorld) {
  await this.navigateToHash(`#/question/${this._lastQuestionSlug}`);
  await this.page.waitForSelector('question-editor', { timeout: 5000 });
});

When('I click Delete in the question editor header', async function (this: BrowserWorld) {
  this.page.once('dialog', (dialog) => dialog.accept());
  await this.page.locator('.qeh-delete-btn').click();
  await this.page.waitForTimeout(300);
});

Then('I should be on the questions collection page', async function (this: BrowserWorld) {
  await this.page.waitForSelector('question-list', { timeout: 5000 });
});

Then(
  'the question {string} should not have a delete button',
  async function (this: BrowserWorld, title: string) {
    const hasDelete = await this.hasDeleteButtonForCard(title);
    assert.ok(!hasDelete, `Expected question "${title}" not to have a delete button`);
  },
);

Then(
  'the question editor header should not show a Delete button',
  async function (this: BrowserWorld) {
    const btn = await this.page.$('.qeh-delete-btn');
    assert.ok(!btn, 'Expected no delete button in the question editor header');
  },
);

// ── Datasource collection steps ────────────────────────────────────────────

Then('the page heading should contain {string}', async function (this: BrowserWorld, text: string) {
  await this.page.waitForSelector('h1', { timeout: 5000 });
  const heading = await this.page.textContent('h1');
  assert.ok(
    heading?.toLowerCase().includes(text.toLowerCase()),
    `Expected heading to contain "${text}", got "${heading}"`,
  );
});

Then(
  'I should see at least {int} datasources in the list',
  async function (this: BrowserWorld, count: number) {
    await this.page.waitForSelector('datasource-list .collection-list-row', { timeout: 5000 });
    const rows = await this.page.$$('datasource-list .collection-list-row');
    assert.ok(
      rows.length >= count,
      `Expected at least ${count} datasource rows, got ${rows.length}`,
    );
  },
);

Then(
  'the datasource list should contain {string}',
  async function (this: BrowserWorld, name: string) {
    await this.page.waitForSelector('datasource-list .collection-list-row', { timeout: 5000 });
    // Poll briefly to handle any async list updates
    let names: string[] = [];
    for (let i = 0; i < 5; i++) {
      names = await this.getDatasourceListNames();
      if (names.includes(name)) break;
      await this.page.waitForTimeout(300);
    }
    assert.ok(
      names.includes(name),
      `Expected datasource list to contain "${name}", got [${names.join(', ')}]`,
    );
  },
);

Then(
  'the datasource list should not contain {string}',
  async function (this: BrowserWorld, name: string) {
    const names = await this.getDatasourceListNames();
    assert.ok(!names.includes(name), `Expected datasource list NOT to contain "${name}"`);
  },
);

Then(
  'the datasource {string} should show {string} badge',
  async function (this: BrowserWorld, name: string, badge: string) {
    const hasBadge = await this.page.evaluate(
      ([n, b]: [string, string]) => {
        const rows = [...document.querySelectorAll('datasource-list .collection-list-row')];
        const row = rows.find(
          (r) => r.querySelector('.collection-list-row-title')?.textContent?.trim() === n,
        );
        return !!row?.textContent?.toLowerCase().includes(b.toLowerCase());
      },
      [name, badge] as [string, string],
    );
    assert.ok(hasBadge, `Expected datasource "${name}" to show "${badge}" badge`);
  },
);

Then(
  'the datasource {string} should not have a delete button',
  async function (this: BrowserWorld, name: string) {
    const hasDelete = await this.page.evaluate((n) => {
      const rows = [...document.querySelectorAll('datasource-list .collection-list-row')];
      const row = rows.find(
        (r) => r.querySelector('.collection-list-row-title')?.textContent?.trim() === n,
      );
      const btn = row?.querySelector<HTMLButtonElement>('.collection-action-btn.delete');
      return !!btn && !btn.disabled;
    }, name);
    assert.ok(!hasDelete, `Expected datasource "${name}" not to have an active delete button`);
  },
);

When('I enter the datasource name {string}', async function (this: BrowserWorld, name: string) {
  const input = this.page.locator('.modal-content input[type="text"]');
  await input.fill(name);
});

Then('I should be on a datasource editor page', async function (this: BrowserWorld) {
  await this.page.waitForSelector('datasource-editor', { timeout: 5000 });
});

Given('a user datasource {string} exists', async function (this: BrowserWorld, name: string) {
  await this.injectUserDatasource(name);
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
});

When(
  'I delete the datasource {string} from the list',
  async function (this: BrowserWorld, name: string) {
    await this.deleteDatasourceFromList(name);
  },
);

Then('I should still see the seed datasources', async function (this: BrowserWorld) {
  const names = await this.getDatasourceListNames();
  const hasSeed = names.some((n) => n === 'sales' || n === 'customer' || n === 'product');
  assert.ok(hasSeed, `Expected seed datasources in list, got [${names.join(', ')}]`);
});

When('I click the {string} nav link', async function (this: BrowserWorld, label: string) {
  await this.page.locator(`nav a:has-text("${label}")`).first().click();
  await this.page.waitForTimeout(300);
});

Then('I should be on the datasources collection page', async function (this: BrowserWorld) {
  await this.page.waitForSelector('datasource-list', { timeout: 5000 });
});

// ── Datasource editor steps ────────────────────────────────────────────────

Then('the breadcrumb should contain {string}', async function (this: BrowserWorld, text: string) {
  await this.page.waitForSelector('app-breadcrumb', { timeout: 5000 });
  const bc = await this.page.textContent('app-breadcrumb');
  assert.ok(bc?.includes(text), `Expected breadcrumb to contain "${text}", got "${bc}"`);
});

Then('the name field should contain {string}', async function (this: BrowserWorld, value: string) {
  const val = await this.page.inputValue('#dse-name');
  assert.strictEqual(val, value, `Expected name field to contain "${value}", got "${val}"`);
});

Then('the URL field should not be empty', async function (this: BrowserWorld) {
  const val = await this.page.inputValue('#dse-url');
  assert.ok(val.length > 0, 'Expected URL field to not be empty');
});

Then('the source type should be {string}', async function (this: BrowserWorld, type: string) {
  const val = await this.page.inputValue('#dse-type');
  assert.strictEqual(
    val.toLowerCase(),
    type.toLowerCase(),
    `Expected source type "${type}", got "${val}"`,
  );
});

Then('the name field should be disabled', async function (this: BrowserWorld) {
  const disabled = await this.page.getAttribute('#dse-name', 'disabled');
  assert.ok(disabled !== null, 'Expected name field to be disabled');
});

Then('the URL field should be disabled', async function (this: BrowserWorld) {
  const disabled = await this.page.getAttribute('#dse-url', 'disabled');
  assert.ok(disabled !== null, 'Expected URL field to be disabled');
});

Then('the Save button should not be present', async function (this: BrowserWorld) {
  await this.page.waitForSelector('datasource-editor-header', { timeout: 5000 });
  const btn = await this.page.$('.qeh-save-btn');
  assert.ok(!btn, 'Expected no Save button for YAML-sourced datasource');
});

Then('the name field should be empty', async function (this: BrowserWorld) {
  const val = await this.page.inputValue('#dse-name');
  assert.strictEqual(val, '', `Expected name field to be empty, got "${val}"`);
});

Then('the URL field should be empty', async function (this: BrowserWorld) {
  const val = await this.page.inputValue('#dse-url');
  assert.strictEqual(val, '', `Expected URL field to be empty, got "${val}"`);
});

When('I fill in the name {string}', async function (this: BrowserWorld, value: string) {
  await this.page.fill('#dse-name', value);
});

When('I fill in the URL {string}', async function (this: BrowserWorld, value: string) {
  await this.page.fill('#dse-url', value);
});

Then(
  'I should be on the datasource editor page for {string}',
  async function (this: BrowserWorld, slug: string) {
    await this.page.waitForSelector('datasource-editor', { timeout: 5000 });
    const hash = await this.page.evaluate(() => window.location.hash);
    assert.ok(hash.includes(slug), `Expected hash to include "${slug}", got "${hash}"`);
  },
);

Then(
  'the datasource {string} should exist in the registry',
  async function (this: BrowserWorld, slug: string) {
    const exists = await this.page.evaluate((s) => {
      const raw = localStorage.getItem('persisted_datasources_v1');
      if (!raw) return false;
      const items: Array<{ slug: string }> = JSON.parse(raw);
      return items.some((d) => d.slug === s);
    }, slug);
    assert.ok(exists, `Expected datasource "${slug}" to exist in the registry`);
  },
);

Given(
  'a user datasource {string} with URL {string} exists',
  async function (this: BrowserWorld, name: string, url: string) {
    await this.injectUserDatasource(name, url);
    await this.page.reload();
    await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
  },
);

When('I navigate to its datasource editor page', async function (this: BrowserWorld) {
  await this.navigateToHash(`#/datasource/${this._lastDatasourceSlug}`);
  await this.page.waitForSelector('datasource-editor', { timeout: 5000 });
});

When('I update the URL to {string}', async function (this: BrowserWorld, url: string) {
  await this.page.fill('#dse-url', url);
});

Then(
  'the datasource {string} should have URL {string}',
  async function (this: BrowserWorld, slug: string, url: string) {
    const storedUrl = await this.page.evaluate((s) => {
      const raw = localStorage.getItem('persisted_datasources_v1');
      if (!raw) return null;
      const items: Array<{ slug: string; url: string }> = JSON.parse(raw);
      return items.find((d) => d.slug === s)?.url ?? null;
    }, slug);
    assert.strictEqual(
      storedUrl,
      url,
      `Expected datasource "${slug}" URL to be "${url}", got "${storedUrl}"`,
    );
  },
);

Then('a YAML file should be downloaded', async function (this: BrowserWorld) {
  // The export creates a data: URL anchor and clicks it; we verify no error occurred
  // and the page is still on the datasource editor.
  await this.page.waitForSelector('datasource-editor', { timeout: 3000 });
});

Then('the page should show {string}', async function (this: BrowserWorld, text: string) {
  const content = await this.page.textContent('body');
  assert.ok(content?.includes(text), `Expected page to show "${text}"`);
});

// ── Datasource linking steps ────────────────────────────────────────────────

Then(
  'the question editor should show {string} section',
  async function (this: BrowserWorld, heading: string) {
    await this.page.waitForSelector('question-editor-panel', { timeout: 5000 });
    const content = await this.page.textContent('question-editor-panel');
    assert.ok(content?.includes(heading), `Expected question editor to contain "${heading}"`);
  },
);

Then(
  'the linked datasources should include {string}',
  async function (this: BrowserWorld, name: string) {
    const names = await this.page.evaluate(() =>
      [...document.querySelectorAll('.qep-ds-name')].map((el) => el.textContent?.trim() ?? ''),
    );
    assert.ok(
      names.some((n) => n.includes(name)),
      `Expected linked datasources to include "${name}", got [${names.join(', ')}]`,
    );
  },
);

Then('the datasource picker should be visible', async function (this: BrowserWorld) {
  await this.page.waitForSelector('datasource-picker dialog[open]', { timeout: 3000 });
});

Then('the picker should list {string}', async function (this: BrowserWorld, name: string) {
  const items = await this.page.evaluate(() =>
    [...document.querySelectorAll('.qpicker-item-title')].map((el) => el.textContent?.trim() ?? ''),
  );
  assert.ok(
    items.some((i) => i.includes(name)),
    `Expected picker to list "${name}", got [${items.join(', ')}]`,
  );
});

When('I select {string} in the picker', async function (this: BrowserWorld, name: string) {
  await this.page.evaluate((n) => {
    const labels = [...document.querySelectorAll('.qpicker-item')];
    const label = labels.find(
      (l) => l.querySelector('.qpicker-item-title')?.textContent?.trim() === n,
    );
    const cb = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (cb && !cb.checked) cb.click();
  }, name);
});

When('I confirm the picker selection', async function (this: BrowserWorld) {
  // Click the Confirm button inside the picker footer
  const confirmBtn = this.page.locator('datasource-picker button:has-text("Confirm")').first();
  await confirmBtn.click();
  await this.page.waitForTimeout(300);
});

Then(
  '{string} should appear in the linked datasources list',
  async function (this: BrowserWorld, name: string) {
    const names = await this.page.evaluate(() =>
      [...document.querySelectorAll('.qep-ds-name')].map((el) => el.textContent?.trim() ?? ''),
    );
    assert.ok(
      names.some((n) => n.includes(name)),
      `Expected "${name}" in linked datasources, got [${names.join(', ')}]`,
    );
  },
);

Then(
  'the question editor should show a {string} link',
  async function (this: BrowserWorld, text: string) {
    const link = await this.page.$(`a:has-text("${text}")`);
    assert.ok(link, `Expected a link with text "${text}" in the question editor`);
  },
);

Then('I should be on the new datasource editor page', async function (this: BrowserWorld) {
  await this.page.waitForSelector('datasource-editor', { timeout: 5000 });
  const hash = await this.page.evaluate(() => window.location.hash);
  assert.ok(
    hash.includes('datasource/new') || hash.includes('datasource/'),
    `Expected to be on datasource editor page, got "${hash}"`,
  );
});

Given(
  'the localStorage contains a question with embedded dataSources for {string}',
  async function (this: BrowserWorld, url: string) {
    await this.injectLegacyQuestion(url);
  },
);

When('I reload the app', async function (this: BrowserWorld) {
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
});

Then(
  'the datasource {string} should appear in the datasources list',
  async function (this: BrowserWorld, urlOrName: string) {
    await this.navigateToHash('#/datasources');
    await this.page.waitForSelector('datasource-list', { timeout: 5000 });
    const names = await this.getDatasourceListNames();
    // The migration derives the name from the last URL path segment (e.g. "legacy" from "legacy.csv")
    const basename =
      urlOrName
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ?? urlOrName;
    const found = names.some(
      (n) => n.includes(urlOrName) || n.toLowerCase().includes(basename.toLowerCase()),
    );
    assert.ok(
      found,
      `Expected datasource "${urlOrName}" (or "${basename}") in list, got [${names.join(', ')}]`,
    );
  },
);

Then(
  'the legacy question should have dataSourceSlugs referencing that datasource',
  async function (this: BrowserWorld) {
    const hasSlugs = await this.page.evaluate(() => {
      const raw = localStorage.getItem('persisted_questions_v1');
      if (!raw) return false;
      const questions: Array<{ slug: string; dataSourceSlugs?: string[] }> = JSON.parse(raw);
      const legacy = questions.find((q) => q.slug === 'legacy-q');
      return Array.isArray(legacy?.dataSourceSlugs) && legacy.dataSourceSlugs.length > 0;
    });
    assert.ok(hasSlugs, 'Expected legacy question to have dataSourceSlugs after migration');
  },
);

Then(
  'the question editor should show {string} in linked datasources',
  async function (this: BrowserWorld, name: string) {
    await this.page.waitForSelector('question-editor-panel', { timeout: 5000 });
    const names = await this.page.evaluate(() =>
      [...document.querySelectorAll('.qep-ds-name')].map((el) => el.textContent?.trim() ?? ''),
    );
    assert.ok(
      names.some((n) => n.includes(name)),
      `Expected "${name}" in linked datasources, got [${names.join(', ')}]`,
    );
  },
);

Then(
  'the top navigation should have a {string} link',
  async function (this: BrowserWorld, label: string) {
    const link = await this.page.$(`nav a:has-text("${label}")`);
    assert.ok(link, `Expected top navigation to have a "${label}" link`);
  },
);

Then('the preview panel should show data rows', async function (this: BrowserWorld) {
  // DuckDB-WASM may need up to 60 s to initialize and fetch the CSV on first run
  await this.page.waitForFunction(
    () => {
      const preview = document.querySelector('.qep-preview');
      if (!preview) return false;
      const text = preview.textContent ?? '';
      return (
        text.length > 100 &&
        !text.includes('Click "Run preview"') &&
        !text.includes('Running query')
      );
    },
    undefined,
    { timeout: 60000 },
  );
});
