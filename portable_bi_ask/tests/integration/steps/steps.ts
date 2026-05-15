import { Given, Then, When } from '@cucumber/cucumber';
import { strict as assert } from 'assert';

import type { AskSuccessResult } from '../../../src/shared/types/index.ts';
import type { AskWorld } from './world.ts';

function success(world: AskWorld): AskSuccessResult {
  const r = world.result;
  assert.ok(r && 'rows' in r, `Expected a successful result but got: ${JSON.stringify(r)}`);
  return r as AskSuccessResult;
}

Given('the data engine is initialized', function (this: AskWorld) {
  // Engine is initialized in BeforeAll; this step is declarative.
  assert.ok(this.getEngine().initialized, 'Engine must be initialized before scenarios run');
});

Then('the chart type is {string}', function (this: AskWorld, expected: string) {
  assert.equal(success(this).chartType, expected);
});

Then('the interpretation contains {string}', function (this: AskWorld, text: string) {
  assert.ok(
    success(this).interpretation.includes(text),
    `"${success(this).interpretation}" does not contain "${text}"`,
  );
});

Then('there are {int} result rows', function (this: AskWorld, count: number) {
  assert.equal(success(this).rows.length, count);
});

Then('the first row label is {string}', function (this: AskWorld, label: string) {
  assert.equal(String(success(this).rows[0]?.label), label);
});

Then('the first row value is close to {float}', function (this: AskWorld, expected: number) {
  const actual = Number(success(this).rows[0]?.value);
  assert.ok(
    Math.abs(actual - expected) < 1,
    `Expected value close to ${expected} but got ${actual}`,
  );
});

Then('the result rows are sorted descending by value', function (this: AskWorld) {
  const rows = success(this).rows;
  for (let i = 1; i < rows.length; i++) {
    assert.ok(
      Number(rows[i - 1]?.value) >= Number(rows[i]?.value),
      `Row ${i - 1} value should be >= row ${i} value`,
    );
  }
});

Then('the result contains the label {string}', function (this: AskWorld, label: string) {
  const labels = success(this).rows.map((r) => String(r.label));
  assert.ok(labels.includes(label), `Label "${label}" not found in [${labels.join(', ')}]`);
});

Then(
  'the first result row has a {string} column with a value between {float} and {float}',
  function (this: AskWorld, col: string, min: number, max: number) {
    const val = Number(success(this).rows[0]?.[col]);
    assert.ok(val >= min && val <= max, `Expected "${col}" in [${min}, ${max}] but got ${val}`);
  },
);

Then('the result is an error', function (this: AskWorld) {
  assert.ok(
    this.result && 'error' in this.result,
    `Expected an error result but got: ${JSON.stringify(this.result)}`,
  );
});

Then('the error message contains {string}', function (this: AskWorld, text: string) {
  assert.ok(this.result && 'error' in this.result, 'No error result available');
  assert.ok(
    (this.result as { error: string }).error.includes(text),
    `Error "${(this.result as { error: string }).error}" does not contain "${text}"`,
  );
});

When('I ask {string}', async function (this: AskWorld, question: string) {
  this.result = await this.getEngine().ask(question);
});

When('I ask {string} twice', async function (this: AskWorld, question: string) {
  await this.getEngine().ask(question);
  this.result = await this.getEngine().ask(question);
});

Then('the catalog should have at least {int} fields', function (this: AskWorld, min: number) {
  assert.ok(
    this.getEngine().catalog.length >= min,
    `Expected >= ${min} fields, got ${this.getEngine().catalog.length}`,
  );
});

Then(
  'the field {string} should have role {string}',
  function (this: AskWorld, fieldKey: string, role: string) {
    const f = this.getEngine().fieldByKey.get(fieldKey);
    assert.ok(f, `Field "${fieldKey}" not found in catalog`);
    assert.equal(f!.role, role);
  },
);

Then(
  'the field {string} should have sample values including {string}',
  function (this: AskWorld, fieldKey: string, value: string) {
    const f = this.getEngine().fieldByKey.get(fieldKey);
    assert.ok(f, `Field "${fieldKey}" not found in catalog`);
    const values = f!.sampleValues ?? [];
    assert.ok(
      values.includes(value),
      `Sample values [${values.join(', ')}] do not include "${value}"`,
    );
  },
);

Then('the confidence should be between 0 and 1', function (this: AskWorld) {
  const r = this.result;
  assert.ok(r && 'confidence' in r, 'Result has no confidence score');
  const c = (r as { confidence: number }).confidence;
  assert.ok(typeof c === 'number' && Number.isFinite(c), `Confidence is not a finite number: ${c}`);
  assert.ok(c >= 0 && c <= 1, `Confidence ${c} is not in [0, 1]`);
});

Given('I remember the current catalog build count', function (this: AskWorld) {
  this._catalogBuildCount = this.catalogBuildCount;
});

Given('I remember the current catalog instance', function (this: AskWorld) {
  this._catalogInstance = this.getEngine().catalog;
});

When(
  'I add customer region {string} to the test data',
  async function (this: AskWorld, region: string) {
    const escapedRegion = region.replaceAll("'", "''");
    await this.db.exec(
      `INSERT INTO customer VALUES ('C-999','Nora','${escapedRegion}','Consumer')`,
    );
  },
);

When('I refresh the data engine catalog', async function (this: AskWorld) {
  await this.getEngine().refreshCatalog();
});

Then('the catalog build count should be unchanged', function (this: AskWorld) {
  assert.notEqual(this._catalogBuildCount, null, 'No catalog build count snapshot available');
  assert.equal(
    this.catalogBuildCount,
    this._catalogBuildCount,
    `Catalog rebuild detected: ${this._catalogBuildCount} -> ${this.catalogBuildCount}`,
  );
});

Then('the catalog instance should be unchanged', function (this: AskWorld) {
  assert.ok(this._catalogInstance, 'No catalog instance snapshot available');
  assert.equal(this.getEngine().catalog, this._catalogInstance, 'Catalog instance was replaced');
});

Then(
  'the catalog build count should increase by {int}',
  function (this: AskWorld, expected: number) {
    assert.notEqual(this._catalogBuildCount, null, 'No catalog build count snapshot available');
    assert.equal(
      this.catalogBuildCount,
      this._catalogBuildCount + expected,
      `Expected catalog build count to increase by ${expected}, got ${this._catalogBuildCount} -> ${this.catalogBuildCount}`,
    );
  },
);
