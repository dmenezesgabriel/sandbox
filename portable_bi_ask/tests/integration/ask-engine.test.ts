import { describe, it, expect, beforeAll } from 'vitest';
import { AskDataEngine } from '../../src/ask-data.ts';
import { NodeDuckDBManager } from '../support/node-duckdb.ts';
import { TEST_CONFIG, setupTestDatabase, EXPECTED } from '../support/fixtures.ts';

let engine: AskDataEngine;
let db: NodeDuckDBManager;

beforeAll(async () => {
  db = new NodeDuckDBManager();
  await setupTestDatabase(db);
  engine = new AskDataEngine(TEST_CONFIG, db);
  await engine.initialize();
});

describe('AskDataEngine – catalog building', () => {
  it('profiles all fields from the three test tables', () => {
    expect(engine.catalog.length).toBeGreaterThan(6);
  });

  it('identifies Sales as a measure field', () => {
    const f = engine.fieldByKey.get('sales::Sales');
    expect(f?.role).toBe('measure');
  });

  it('identifies Order Date as a time field', () => {
    const f = engine.fieldByKey.get('sales::Order Date');
    expect(f?.role).toBe('time');
  });

  it('identifies Region as a dimension field with known sample values', () => {
    const f = engine.fieldByKey.get('customer::Region');
    expect(f?.role).toBe('dimension');
    expect(f?.sampleValues).toContain('West');
  });
});

describe('AskDataEngine – ask()', () => {
  it('"sales by region" returns bar chart sorted by value desc', async () => {
    const result = await engine.ask('sales by region');
    expect('rows' in result).toBe(true);
    if (!('rows' in result)) return;
    expect(result.chartType).toBe('bar');
    expect(result.interpretation).toContain('Region');
    expect(result.rows[0]?.label).toBe('West');
    expect(result.rows[0]?.value).toBeCloseTo(EXPECTED.salesByRegion.West, 0);
    expect(result.rows).toHaveLength(4);
  });

  it('"sales in 2017" returns a kpi with the 2017 total', async () => {
    const result = await engine.ask('sales in 2017');
    expect('rows' in result).toBe(true);
    if (!('rows' in result)) return;
    expect(result.chartType).toBe('kpi');
    expect(Number(result.rows[0]?.value)).toBeCloseTo(EXPECTED.sales2017, 0);
  });

  it('"what categories do i have" lists all three categories', async () => {
    const result = await engine.ask('what categories do i have');
    expect('rows' in result).toBe(true);
    if (!('rows' in result)) return;
    expect(result.chartType).toBe('table');
    const labels = result.rows.map((r) => r.label);
    expect(labels).toContain('Technology');
    expect(labels).toContain('Furniture');
    expect(labels).toContain('Office Supplies');
  });

  it('"top 3 products by sales" returns exactly 3 rows', async () => {
    const result = await engine.ask('top 3 products by sales');
    expect('rows' in result).toBe(true);
    if (!('rows' in result)) return;
    expect(result.rows).toHaveLength(3);
    expect(Number(result.rows[0]?.value)).toBeGreaterThan(Number(result.rows[1]?.value ?? 0));
  });

  it('"lucro por região" returns an error for unsupported metric', async () => {
    const result = await engine.ask('lucro por região');
    expect('error' in result).toBe(true);
  });

  it('confidence is included and is a finite number in [0, 1]', async () => {
    const result = await engine.ask('sales by region');
    if (!('confidence' in result)) return;
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('second call skips re-initialization (cached catalog)', async () => {
    const before = engine.metrics.catalogBuildMs as number;
    await engine.ask('sales by region');
    expect(engine.metrics.catalogBuildMs).toBe(before);
  });
});
