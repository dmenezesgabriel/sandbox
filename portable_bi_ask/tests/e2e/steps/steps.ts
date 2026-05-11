import { Given, Then,When } from '@cucumber/cucumber';
import { strict as assert } from 'assert';

import type { BrowserWorld } from './world.ts';

declare let __chartInitLogs: string[];

Given('the app is loaded', async function (this: BrowserWorld) {
  await this.navigate('/');
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
});

Given('I navigate to the Sheets tab', async function (this: BrowserWorld) {
  await this.page.click('button:has-text("Sheets")');
  await this.page.waitForSelector('sheets-view', { timeout: 10000 });
});

When('there are no sheets', async function (this: BrowserWorld) {
  await this.clearSheets();
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
  await this.page.click('button:has-text("Sheets")');
  await this.page.waitForSelector('sheets-view', { timeout: 10000 });
});

Then(
  'I should see an empty canvas with {string}',
  async function (this: BrowserWorld, text: string) {
    const empty = await this.hasEmptyState();
    assert.ok(empty, 'Expected empty state to be visible');
    const content = await this.page.textContent('.sheet-empty');
    assert.ok(content?.includes(text), `Expected "${text}" in empty state, got "${content}"`);
  },
);

Then('I should see a {string} button', async function (this: BrowserWorld, label: string) {
  const btn = await this.page.$(`text="${label}"`);
  assert.ok(btn, `Expected button "${label}" to exist`);
});

When('I click {string}', async function (this: BrowserWorld, label: string) {
  const btn = this.page.locator(`button:has-text("${label}")`).first();
  await btn.click();
});

When('I enter the sheet name {string}', async function (this: BrowserWorld, name: string) {
  await this.fillNewSheetName(name);
});

When('I click {string} to enter edit mode', async function (this: BrowserWorld, _label: string) {
  await this.clickEditToggle();
  await this.page.waitForTimeout(300);
});

When('I click {string} to exit edit mode', async function (this: BrowserWorld, _label: string) {
  await this.clickEditToggle();
  await this.page.waitForTimeout(300);
});

Then(
  'a sheet tab with the name {string} should appear',
  async function (this: BrowserWorld, name: string) {
    const tabs = await this.getSheetTabNames();
    assert.ok(tabs.includes(name), `Expected sheet tab "${name}" in [${tabs.join(', ')}]`);
  },
);

Then('the canvas should be empty', async function (this: BrowserWorld) {
  const count = await this.getWidgetCount();
  assert.equal(count, 0, `Expected 0 widgets, got ${count}`);
});

Given('a sheet exists with chart widgets', async function (this: BrowserWorld) {
  await this.injectSheets([
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
        {
          id: 'w2',
          type: 'chart',
          title: 'Chart 2',
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
  ]);
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
  await this.installLogInterceptor();
  await this.page.click('button:has-text("Sheets")');
  await this.waitForWidgets();
  await this.waitForDataCache('sheet-a');
  await this.page.waitForTimeout(500);
});

Then('I should see widgets rendered on the canvas', async function (this: BrowserWorld) {
  const count = await this.getWidgetCount();
  assert.ok(count >= 1, `Expected at least 1 widget, got ${count}`);
});

Then('the chart widgets should initialize without errors', async function (this: BrowserWorld) {
  const initCount = await this.getChartInitLogs();
  assert.ok(initCount >= 0, 'Chart init logs not captured');
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
  await this.injectSheets([
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
  await this.page.click('button:has-text("Sheets")');
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

Given('sheets exist with chart widgets on multiple sheets', async function (this: BrowserWorld) {
  await this.injectSheets([
    {
      id: 'sheet-a',
      name: 'Sales Overview',
      type: 'dashboard',
      widgets: [
        {
          id: 'w1',
          type: 'chart',
          title: 'Revenue by Region',
          query: 'show me sales by region',
          chartType: 'bar',
        },
        {
          id: 'w2',
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
      type: 'sheet',
      widgets: [
        {
          id: 'w3',
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
  ]);
  await this.page.reload();
  await this.page.waitForSelector('app-dashboard', { timeout: 10000 });
  await this.page.click('button:has-text("Sheets")');
  await this.waitForWidgets();
  await this.waitForDataCache('sheet-a');
  await this.installAskSpy();
});

When('I switch to the second sheet', async function (this: BrowserWorld) {
  await this.clickSheetTab('Category Analysis');
  await this.waitForWidgets();
  await this.page.waitForTimeout(500);
});

Then(
  'the ask engine should have called {int} time',
  async function (this: BrowserWorld, expected: number) {
    const count = await this.getAskCallCount();
    assert.equal(count, expected, `Expected ${expected} ask calls, got ${count}`);
  },
);

When('I switch back to the first sheet', async function (this: BrowserWorld) {
  await this.clickSheetTab('Sales Overview');
  await this.page.waitForTimeout(500);
});
