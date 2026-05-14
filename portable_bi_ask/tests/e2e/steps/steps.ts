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
  const btn = this.page.locator(`button:has-text("${label}")`).first();
  await btn.click();
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
    const titles = await this.getQuestionCardTitles();
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
      const cards = [...document.querySelectorAll('.question-card')];
      const card = cards.find(
        (c) => c.querySelector('.question-card-title')?.textContent?.trim() === t,
      );
      const btn = card?.querySelector<HTMLButtonElement>('.question-card-delete');
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
