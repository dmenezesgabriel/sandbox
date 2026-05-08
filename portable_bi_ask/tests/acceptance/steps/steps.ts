import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';
import type { AskWorld } from './world.ts';
import type { AskSuccessResult } from '../../../src/types.ts';

function success(world: AskWorld): AskSuccessResult {
  const r = world.result;
  assert.ok(r && 'rows' in r, `Expected a successful result but got: ${JSON.stringify(r)}`);
  return r as AskSuccessResult;
}

Given('the data engine is initialized', function (this: AskWorld) {
  // Engine is initialized in BeforeAll; this step is declarative.
  assert.ok(this.getEngine().initialized, 'Engine must be initialized before scenarios run');
});

When('I ask {string}', async function (this: AskWorld, question: string) {
  this.result = await this.getEngine().ask(question);
});

Then('the chart type is {string}', function (this: AskWorld, expected: string) {
  assert.equal(success(this).chartType, expected);
});

Then('the interpretation contains {string}', function (this: AskWorld, text: string) {
  assert.ok(success(this).interpretation.includes(text), `"${success(this).interpretation}" does not contain "${text}"`);
});

Then('there are {int} result rows', function (this: AskWorld, count: number) {
  assert.equal(success(this).rows.length, count);
});

Then('the first row label is {string}', function (this: AskWorld, label: string) {
  assert.equal(String(success(this).rows[0]?.label), label);
});

Then('the first row value is close to {float}', function (this: AskWorld, expected: number) {
  const actual = Number(success(this).rows[0]?.value);
  assert.ok(Math.abs(actual - expected) < 1, `Expected value close to ${expected} but got ${actual}`);
});

Then('the result rows are sorted descending by value', function (this: AskWorld) {
  const rows = success(this).rows;
  for (let i = 1; i < rows.length; i++) {
    assert.ok(Number(rows[i - 1]?.value) >= Number(rows[i]?.value), `Row ${i - 1} value should be >= row ${i} value`);
  }
});

Then('the result contains the label {string}', function (this: AskWorld, label: string) {
  const labels = success(this).rows.map(r => String(r.label));
  assert.ok(labels.includes(label), `Label "${label}" not found in [${labels.join(', ')}]`);
});

Then('the first result row has a {string} column with a value between {float} and {float}', function (this: AskWorld, col: string, min: number, max: number) {
  const val = Number(success(this).rows[0]?.[col]);
  assert.ok(val >= min && val <= max, `Expected "${col}" in [${min}, ${max}] but got ${val}`);
});

Then('the result is an error', function (this: AskWorld) {
  assert.ok(this.result && 'error' in this.result, `Expected an error result but got: ${JSON.stringify(this.result)}`);
});

Then('the error message contains {string}', function (this: AskWorld, text: string) {
  assert.ok(this.result && 'error' in this.result, 'No error result available');
  assert.ok((this.result as { error: string }).error.includes(text), `Error "${(this.result as { error: string }).error}" does not contain "${text}"`);
});
