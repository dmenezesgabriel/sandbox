import { describe, expect, it } from 'vitest';

import type { AskIntent, CatalogField, DateRange, Relationship } from '../../../shared/types/index';
import { SqlPlanner } from './sql-planner';

// --- Helpers ---

function makeField(overrides: Partial<CatalogField> = {}): CatalogField {
  return {
    id: 'sales::Sales',
    table: 'sales',
    column: 'Sales',
    role: 'measure',
    type: 'DOUBLE',
    label: 'Sales',
    labels: {},
    synonyms: [],
    localizedSynonyms: {},
    description: '',
    default: true,
    priority: 20,
    sampleValues: [],
    samples: [],
    dateProfile: null,
    cardinality: 0,
    rowCount: 100,
    aggregation: 'SUM',
    ...overrides,
  };
}

const salesField = makeField({
  id: 'sales::Sales',
  table: 'sales',
  column: 'Sales',
  role: 'measure',
  type: 'DOUBLE',
  label: 'Sales',
  aggregation: 'SUM',
});

const regionField = makeField({
  id: 'customer::Region',
  table: 'customer',
  column: 'Region',
  role: 'dimension',
  type: 'VARCHAR',
  label: 'Region',
  aggregation: undefined,
});

const timeField = makeField({
  id: 'sales::Order Date',
  table: 'sales',
  column: 'Order Date',
  role: 'time',
  type: 'DATE',
  label: 'Order Date',
});

const timeFieldVarchar = makeField({
  id: 'sales::Created At',
  table: 'sales',
  column: 'Created At',
  role: 'time',
  type: 'VARCHAR',
  label: 'Created At',
  parseFormat: '%Y-%m-%d',
});

const categoryField = makeField({
  id: 'product::Category',
  table: 'product',
  column: 'Category',
  role: 'dimension',
  type: 'VARCHAR',
  label: 'Category',
  aggregation: undefined,
});

function makeIntent(overrides: Partial<AskIntent> = {}): AskIntent {
  return {
    question: '',
    analysisType: 'kpi',
    metric: salesField,
    dimensions: [],
    filters: [],
    ...overrides,
  };
}

const singleTableRelationships: Relationship[] = [];

const twoTableRelationships: Relationship[] = [
  {
    left: { table: 'sales', column: 'Customer ID' },
    right: { table: 'customer', column: 'ID' },
    confidence: 1,
  },
];

const threeTableRelationships: Relationship[] = [
  {
    left: { table: 'sales', column: 'Customer ID' },
    right: { table: 'customer', column: 'ID' },
    confidence: 1,
  },
  {
    left: { table: 'sales', column: 'Product ID' },
    right: { table: 'product', column: 'ID' },
    confidence: 1,
  },
];

function makePlanner(
  overrides: {
    config?: { dataSources?: Array<{ name: string }>; relationships?: Relationship[] };
    askConfig?: { maxRows?: number; maxDimensions?: number; validation?: Record<string, unknown> };
    relationships?: () => Relationship[];
    getDefaultTimeField?: () => CatalogField | undefined;
  } = {},
) {
  return new SqlPlanner({
    config: overrides.config || { dataSources: [{ name: 'sales' }], relationships: [] },
    askConfig: overrides.askConfig,
    relationships: overrides.relationships || (() => singleTableRelationships),
    getDefaultTimeField: overrides.getDefaultTimeField || (() => timeField),
  });
}

// ───────────────────────────────────────────────
// plan() - analysis types
// ───────────────────────────────────────────────

describe('SqlPlanner', () => {
  describe('plan() - kpi', () => {
    it('generates a simple aggregate SQL for kpi with no dimensions', () => {
      const planner = makePlanner();
      const result = planner.plan(makeIntent({ analysisType: 'kpi', dimensions: [] }));
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain('SUM(t0_sales."Sales") AS value');
      expect(result.sql).toContain('FROM "sales" t0_sales');
      expect(result.columns).toEqual(['value']);
      expect(result.metricFormat).toBeUndefined();
    });

    it('uses the configured maxRows as default limit for grouped kpi', () => {
      const planner = makePlanner({
        askConfig: { maxRows: 50 },
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({ analysisType: 'ranking', dimensions: [regionField] }),
      );
      expect(result.sql).toContain('LIMIT 50');
    });
  });

  describe('plan() - ranking', () => {
    it('generates grouped SQL with ORDER BY value DESC', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'ranking',
          dimensions: [regionField],
          sort: { by: 'value', direction: 'DESC' },
        }),
      );
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain('GROUP BY');
      expect(result.sql).toContain('ORDER BY value DESC');
      expect(result.columns).toEqual(['label', 'value']);
    });

    it('respects custom limit', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'ranking',
          dimensions: [regionField],
          limit: 10,
        }),
      );
      expect(result.sql).toContain('LIMIT 10');
    });
  });

  describe('plan() - trend', () => {
    it('generates grouped SQL with time dimension and ORDER BY label ASC', () => {
      const planner = makePlanner();
      const intent = makeIntent({
        analysisType: 'trend',
        dimensions: [timeField],
        timeGrain: 'month',
      });
      const result = planner.plan(intent);
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain("DATE_TRUNC('month'");
      expect(result.sql).toContain('ORDER BY label ASC');
    });

    it('defaults time grain to month when not specified', () => {
      const planner = makePlanner();
      const intent = makeIntent({
        analysisType: 'trend',
        dimensions: [timeField],
      });
      const result = planner.plan(intent);
      expect(result.sql).toContain("DATE_TRUNC('month'");
    });

    it('uses year grain for yoy analysis', () => {
      const planner = makePlanner();
      const result = planner.plan(
        makeIntent({
          analysisType: 'yoy',
          timeField,
          timeGrain: 'year',
          dimensions: [],
        }),
      );
      expect(result.sql).toContain("DATE_TRUNC('year'");
    });

    it('handles non-native date fields with parseFormat using STRPTIME', () => {
      const planner = makePlanner();
      const result = planner.plan(
        makeIntent({
          analysisType: 'trend',
          dimensions: [timeFieldVarchar],
          timeGrain: 'month',
        }),
      );
      expect(result.sql).toContain('STRPTIME');
      expect(result.sql).toContain("'%Y-%m-%d'");
    });

    it('handles non-native date fields without parseFormat using TRY_CAST', () => {
      const planner = makePlanner();
      const varcharTimeField = makeField({
        id: 'sales::Created At',
        table: 'sales',
        column: 'Created At',
        role: 'time',
        type: 'VARCHAR',
        label: 'Created At',
        parseFormat: null,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'trend',
          dimensions: [varcharTimeField],
          timeGrain: 'month',
        }),
      );
      expect(result.sql).toContain('TRY_CAST');
    });
  });

  describe('plan() - list_values', () => {
    it('generates DISTINCT query for list_values', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'list_values',
          metric: null,
          dimensions: [regionField],
          limit: 15,
        }),
      );
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain('SELECT DISTINCT');
      expect(result.sql).toContain('IS NOT NULL');
      expect(result.sql).toContain('CAST(');
      expect(result.sql).toContain('ORDER BY label ASC');
      expect(result.sql).toContain('LIMIT 15');
      expect(result.columns).toEqual(['label']);
    });

    it('uses default maxRows when limit not specified', () => {
      const planner = makePlanner({
        askConfig: { maxRows: 30 },
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'list_values',
          metric: null,
          dimensions: [regionField],
        }),
      );
      expect(result.sql).toContain('LIMIT 30');
    });
  });

  describe('plan() - yoy', () => {
    it('generates year-over-year CTE query', () => {
      const planner = makePlanner();
      const result = planner.plan(
        makeIntent({
          analysisType: 'yoy',
          timeField,
          dimensions: [],
        }),
      );
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain('WITH yearly AS');
      expect(result.sql).toContain('LAG(value)');
      expect(result.sql).toContain('change_percent');
      expect(result.columns).toEqual([
        'period',
        'value',
        'previous_value',
        'change',
        'change_percent',
      ]);
    });

    it('returns error when no time field is found', () => {
      const planner = makePlanner({ getDefaultTimeField: () => undefined });
      const result = planner.plan(
        makeIntent({
          analysisType: 'yoy',
          timeField: undefined,
          dimensions: [],
        }),
      );
      expect(result.error).toContain('date/time field');
    });
  });

  describe('plan() - change', () => {
    it('generates change query with start and end years', () => {
      const planner = makePlanner();
      const result = planner.plan(
        makeIntent({
          analysisType: 'change',
          change: { startYear: 2022, endYear: 2023 },
        }),
      );
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain('2022');
      expect(result.sql).toContain('2023');
      expect(result.sql).toContain('start_value');
      expect(result.sql).toContain('end_value');
      expect(result.sql).toContain('change_percent');
      expect(result.columns).toEqual([
        'period',
        'start_value',
        'end_value',
        'change',
        'change_percent',
      ]);
    });

    it('returns error when no time field is found', () => {
      const planner = makePlanner({ getDefaultTimeField: () => undefined });
      const result = planner.plan(
        makeIntent({
          analysisType: 'change',
          timeField: undefined,
          change: { startYear: 2022, endYear: 2023 },
        }),
      );
      expect(result.error).toContain('date/time field');
    });
  });

  describe('plan() - share', () => {
    it('generates share of total query with CTE', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'share',
          dimensions: [regionField],
          shareValues: null,
        }),
      );
      expect(result.error).toBeUndefined();
      expect(result.sql).toContain('WITH grouped AS');
      expect(result.sql).toContain('SUM(value) OVER ()');
      expect(result.sql).toContain('share');
      expect(result.columns).toEqual(['label', 'value', 'share']);
    });

    it('returns error when no dimensions provided', () => {
      const planner = makePlanner();
      const result = planner.plan(
        makeIntent({
          analysisType: 'share',
          dimensions: [],
        }),
      );
      expect(result.error).toContain('dimension');
    });

    it('filters by shareValues when provided', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'share',
          dimensions: [regionField],
          shareValues: ['East', 'West'],
        }),
      );
      expect(result.sql).toContain("WHERE label IN ('East', 'West')");
    });
  });

  describe('plan() - filters and date ranges', () => {
    it('applies equality filters in WHERE clause', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          dimensions: [regionField],
          filters: [{ field: regionField, operator: '=', value: 'East' }],
        }),
      );
      expect(result.sql).toContain('"Region" = \'East\'');
    });

    it('applies IN filters', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          dimensions: [regionField],
          filters: [{ field: regionField, operator: 'IN', values: ['East', 'West'] }],
        }),
      );
      expect(result.sql).toContain("'East', 'West'");
      expect(result.sql).toContain('IN');
    });

    it('escapes single quotes in filter values', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          dimensions: [regionField],
          filters: [{ field: regionField, operator: '=', value: "O'Brien" }],
        }),
      );
      expect(result.sql).toContain("O''Brien");
    });

    it('applies date range filter with start/end format', () => {
      const planner = makePlanner();
      const dateRange: DateRange = {
        field: timeField,
        start: '2024-01-01',
        end: '2024-12-31',
        text: 'in 2024',
      };
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          dimensions: [timeField],
          dateRange,
        }),
      );
      expect(result.sql).toContain("DATE '2024-01-01'");
      expect(result.sql).toContain("DATE '2024-12-31'");
    });

    it('applies monthOfYear date range filter', () => {
      const planner = makePlanner();
      const dateRange: DateRange = {
        field: timeField,
        kind: 'monthOfYear',
        month: 3,
        text: 'in March',
      };
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          dimensions: [timeField],
          dateRange,
        }),
      );
      expect(result.sql).toContain('EXTRACT(month FROM');
      expect(result.sql).toContain('= 3');
    });
  });

  describe('plan() - count_star metric', () => {
    it('generates COUNT(*) for count_star metric', () => {
      const planner = makePlanner();
      const result = planner.plan(
        makeIntent({
          analysisType: 'ranking',
          dimensions: [timeField],
          metric: { kind: 'count_star', label: 'Records' },
        }),
      );
      expect(result.sql).toContain('COUNT(*)');
    });
  });

  describe('plan() - count_distinct metric', () => {
    it('generates COUNT(DISTINCT ...) for count_distinct metric', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'ranking',
          dimensions: [regionField],
          metric: {
            kind: 'count_distinct',
            entity: {
              label: 'Customer',
              singular: 'customer',
              table: 'customer',
              key: 'Customer ID',
              field: regionField,
              terms: ['customer'],
            },
            field: regionField,
            label: 'Distinct Regions',
          },
        }),
      );
      expect(result.sql).toContain('COUNT(DISTINCT');
      expect(result.sql).toContain('"Region"');
    });
  });

  // ───────────────────────────────────────────────
  // buildJoinPlan()
  // ───────────────────────────────────────────────

  describe('buildJoinPlan()', () => {
    it('returns single table with no joins when only base table is needed', () => {
      const planner = makePlanner();
      const result = planner.buildJoinPlan('sales', ['sales']);
      expect(result.tables).toEqual(['sales']);
      expect(result.joins).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('returns error when no relationship path is found', () => {
      const planner = makePlanner({
        relationships: () => [],
      });
      const result = planner.buildJoinPlan('sales', ['sales', 'unknown_table']);
      expect(result.error).toContain('I do not know how to join');
    });

    it('builds join for directly related table', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.buildJoinPlan('sales', ['sales', 'customer']);
      expect(result.tables).toEqual(['sales', 'customer']);
      expect(result.joins!).toHaveLength(1);
      expect(result.joins![0].left.table).toBe('sales');
      expect(result.joins![0].left.column).toBe('Customer ID');
      expect(result.joins![0].right.table).toBe('customer');
      expect(result.joins![0].right.table).toBe('customer');
    });

    it('builds multi-hop joins for indirectly related tables', () => {
      const planner = makePlanner({
        relationships: () => threeTableRelationships,
      });
      const result = planner.buildJoinPlan('sales', ['sales', 'customer', 'product']);
      expect(result.tables).toContain('sales');
      expect(result.tables).toContain('customer');
      expect(result.tables).toContain('product');
      expect(result.joins).toHaveLength(2);
    });

    it('reverses join direction when navigating from right to left', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.buildJoinPlan('customer', ['customer', 'sales']);
      expect(result.joins!).toHaveLength(1);
      expect(result.joins![0].left.table).toBe('customer');
      expect(result.joins![0].left.column).toBe('ID');
      expect(result.joins![0].right.table).toBe('sales');
      expect(result.joins![0].right.column).toBe('Customer ID');
    });

    it('handles already-tables in the needed list gracefully', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const result = planner.buildJoinPlan('sales', ['sales']);
      expect(result.joins).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────
  // buildDiagnostics()
  // ───────────────────────────────────────────────

  describe('buildDiagnostics()', () => {
    it('returns null when no joins, no filters, and no time field', () => {
      const planner = makePlanner();
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [], filters: [], timeField: undefined }),
        baseTable: 'sales',
        aliases: new Map([['sales', 't0_sales']]),
        from: '"sales" t0_sales',
        joinSqls: [],
        joinRels: [],
        whereParts: [],
      });
      expect(diagnostics).toBeNull();
    });

    it('returns joinFanout diagnostics when joins are present', () => {
      const planner = makePlanner();
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [], filters: [] }),
        baseTable: 'sales',
        aliases: new Map([
          ['sales', 't0_sales'],
          ['customer', 't1_customer'],
        ]),
        from: '"sales" t0_sales',
        joinSqls: ['JOIN "customer" t1_customer ON t0_sales."Customer ID" = t1_customer."ID"'],
        joinRels: [
          {
            left: { table: 'sales', column: 'Customer ID' },
            right: { table: 'customer', column: 'ID' },
          },
        ],
        whereParts: [],
      });
      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.joinFanout).toBeDefined();
      expect(diagnostics!.joinFanout!.baseCountSql).toContain('COUNT(*)');
      expect(diagnostics!.joinFanout!.joinedCountSql).toContain('COUNT(*)');
      expect(diagnostics!.joinFanout!.threshold).toBe(1.5);
      expect(diagnostics!.joinFanout!.minExtraRows).toBe(100);
    });

    it('returns filterSelectivity diagnostics when filters are present', () => {
      const planner = makePlanner();
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({
          dimensions: [],
          filters: [{ field: regionField, operator: '=', value: 'East' }],
        }),
        baseTable: 'sales',
        aliases: new Map([['sales', 't0_sales']]),
        from: '"sales" t0_sales',
        joinSqls: [],
        joinRels: [],
        whereParts: ['t0_sales."Region" = \'East\''],
      });
      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.filterSelectivity).toBeDefined();
      expect(diagnostics!.filterSelectivity!.unfilteredCountSql).toContain('COUNT(*)');
      expect(diagnostics!.filterSelectivity!.filteredCountSql).toContain('Region');
      expect(diagnostics!.filterSelectivity!.threshold).toBe(0.1);
    });

    it('returns dateParse diagnostics when time field is present', () => {
      const planner = makePlanner();
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [timeFieldVarchar] }),
        baseTable: 'sales',
        aliases: new Map([['sales', 't0_sales']]),
        from: '"sales" t0_sales',
        joinSqls: [],
        joinRels: [],
        whereParts: [],
      });
      expect(diagnostics).not.toBeNull();
      expect(diagnostics!.dateParse).toBeDefined();
      expect(diagnostics!.dateParse!.field).toBe('Created At');
      expect(diagnostics!.dateParse!.sql).toContain('dropped_rows');
    });

    it('uses TRY_CAST for non-native date fields without parseFormat', () => {
      const planner = makePlanner();
      const varcharNoFormat = makeField({
        id: 'sales::Created At',
        table: 'sales',
        column: 'Created At',
        role: 'time',
        type: 'VARCHAR',
        label: 'Created At',
        parseFormat: null,
      });
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [varcharNoFormat] }),
        baseTable: 'sales',
        aliases: new Map([['sales', 't0_sales']]),
        from: '"sales" t0_sales',
        joinSqls: [],
        joinRels: [],
        whereParts: [],
      });
      expect(diagnostics!.dateParse!.sql).toContain('TRY_CAST');
    });

    it('uses STRPTIME for non-native date fields with parseFormat', () => {
      const planner = makePlanner();
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [timeFieldVarchar] }),
        baseTable: 'sales',
        aliases: new Map([['sales', 't0_sales']]),
        from: '"sales" t0_sales',
        joinSqls: [],
        joinRels: [],
        whereParts: [],
      });
      expect(diagnostics!.dateParse!.sql).toContain('TRY_STRPTIME');
      expect(diagnostics!.dateParse!.sql).toContain("'%Y-%m-%d'");
    });

    it('includes base-only WHERE clause in joinFanout baseCountSql', () => {
      const planner = makePlanner();
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({
          dimensions: [regionField],
          filters: [{ field: regionField, operator: '=', value: 'East' }],
        }),
        baseTable: 'sales',
        aliases: new Map([
          ['sales', 't0_sales'],
          ['customer', 't1_customer'],
        ]),
        from: '"sales" t0_sales',
        joinSqls: ['JOIN "customer" t1_customer ON ...'],
        joinRels: [
          {
            left: { table: 'sales', column: 'Customer ID' },
            right: { table: 'customer', column: 'ID' },
          },
        ],
        whereParts: ['t0_sales."Region" = \'East\'', 't1_customer."Status" = \'Active\''],
      });
      expect(diagnostics!.joinFanout!.baseCountSql).toContain('Region');
      expect(diagnostics!.joinFanout!.baseCountSql).not.toContain('Status');
      expect(diagnostics!.joinFanout!.joinedCountSql).toContain('Region');
      expect(diagnostics!.joinFanout!.joinedCountSql).toContain('Status');
    });
  });

  // ───────────────────────────────────────────────
  // Configuration options
  // ───────────────────────────────────────────────

  describe('configuration options', () => {
    it('uses custom maxRows as default LIMIT for grouped queries', () => {
      const planner = makePlanner({ askConfig: { maxRows: 42 } });
      const result = planner.plan(makeIntent({ analysisType: 'ranking', dimensions: [timeField] }));
      expect(result.sql).toContain('LIMIT 42');
    });

    it('uses custom maxRows for list_values', () => {
      const planner = makePlanner({
        askConfig: { maxRows: 42 },
        relationships: () => twoTableRelationships,
      });
      const result = planner.plan(
        makeIntent({ analysisType: 'list_values', metric: null, dimensions: [regionField] }),
      );
      expect(result.sql).toContain('LIMIT 42');
    });

    it('uses custom joinFanoutRatio threshold in diagnostics', () => {
      const planner = makePlanner({
        askConfig: { validation: { joinFanoutRatio: 3.0 } },
      });
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [], filters: [] }),
        baseTable: 'sales',
        aliases: new Map([
          ['sales', 't0_sales'],
          ['customer', 't1_customer'],
        ]),
        from: '"sales" t0_sales',
        joinSqls: ['JOIN "customer" t1_customer ON ...'],
        joinRels: [
          {
            left: { table: 'sales', column: 'Customer ID' },
            right: { table: 'customer', column: 'ID' },
          },
        ],
        whereParts: [],
      });
      expect(diagnostics!.joinFanout!.threshold).toBe(3.0);
    });

    it('uses custom joinFanoutMinExtraRows in diagnostics', () => {
      const planner = makePlanner({
        askConfig: { validation: { joinFanoutMinExtraRows: 500 } },
      });
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({ dimensions: [], filters: [] }),
        baseTable: 'sales',
        aliases: new Map([
          ['sales', 't0_sales'],
          ['customer', 't1_customer'],
        ]),
        from: '"sales" t0_sales',
        joinSqls: ['JOIN "customer" t1_customer ON ...'],
        joinRels: [
          {
            left: { table: 'sales', column: 'Customer ID' },
            right: { table: 'customer', column: 'ID' },
          },
        ],
        whereParts: [],
      });
      expect(diagnostics!.joinFanout!.minExtraRows).toBe(500);
    });

    it('uses custom filterSelectivityRatio threshold in diagnostics', () => {
      const planner = makePlanner({
        askConfig: { validation: { filterSelectivityRatio: 0.05 } },
      });
      const diagnostics = planner.buildDiagnostics({
        intent: makeIntent({
          dimensions: [],
          filters: [{ field: regionField, operator: '=', value: 'East' }],
        }),
        baseTable: 'sales',
        aliases: new Map([['sales', 't0_sales']]),
        from: '"sales" t0_sales',
        joinSqls: [],
        joinRels: [],
        whereParts: ['t0_sales."Region" = \'East\''],
      });
      expect(diagnostics!.filterSelectivity!.threshold).toBe(0.05);
    });

    it('uses dataSources config to determine base table when no metric table', () => {
      const planner = makePlanner({
        config: { dataSources: [{ name: 'orders' }], relationships: [] },
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          metric: null,
          dimensions: [],
        }),
      );
      expect(result.sql).toContain('"orders"');
    });

    it('falls back to default 25 LIMIT when maxRows not set', () => {
      const planner = makePlanner();
      const result = planner.plan(makeIntent({ analysisType: 'ranking', dimensions: [timeField] }));
      expect(result.sql).toContain('LIMIT 25');
    });
  });

  // ───────────────────────────────────────────────
  // plan() - join edge cases
  // ───────────────────────────────────────────────

  describe('plan() - join error handling', () => {
    it('returns error when join cannot be resolved', () => {
      const planner = makePlanner({
        relationships: () => [],
      });
      const result = planner.plan(
        makeIntent({
          analysisType: 'kpi',
          dimensions: [regionField],
        }),
      );
      expect(result.error).toContain('I do not know how to join');
    });
  });

  // ───────────────────────────────────────────────
  // timeSqlExpression()
  // ───────────────────────────────────────────────

  describe('timeSqlExpression()', () => {
    it('uses quoted column for native date types', () => {
      const planner = makePlanner();
      const expr = planner.timeSqlExpression(timeField, 't0');
      expect(expr).toBe('t0."Order Date"');
    });

    it('uses STRPTIME for varchar fields with parseFormat', () => {
      const planner = makePlanner();
      const expr = planner.timeSqlExpression(timeFieldVarchar, 't0');
      expect(expr).toContain('STRPTIME');
      expect(expr).toContain("'%Y-%m-%d'");
    });

    it('uses TRY_CAST for varchar fields without parseFormat', () => {
      const planner = makePlanner();
      const varcharNoFormat = makeField({
        id: 'sales::Created At',
        table: 'sales',
        column: 'Created At',
        role: 'time',
        type: 'VARCHAR',
        parseFormat: null,
      });
      const expr = planner.timeSqlExpression(varcharNoFormat, 't0');
      expect(expr).toContain('TRY_CAST');
      expect(expr).toContain('AS DATE');
    });
  });

  // ───────────────────────────────────────────────
  // buildMetricExpr()
  // ───────────────────────────────────────────────

  describe('buildMetricExpr()', () => {
    it('returns COUNT(*) for count_star', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildMetricExpr(
        { ...makeIntent(), metric: { kind: 'count_star', label: 'Records' } },
        aliases,
      );
      expect(result.metricExpr).toBe('COUNT(*)');
    });

    it('returns COUNT(DISTINCT ...) for count_distinct', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildMetricExpr(
        {
          ...makeIntent(),
          metric: { kind: 'count_distinct', field: salesField, label: 'Distinct' },
        },
        aliases,
      );
      expect(result.metricExpr).toContain('COUNT(DISTINCT');
      expect(result.metricExpr).toContain('"Sales"');
    });

    it('uses custom aggregation function', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const avgField = makeField({
        id: 'sales::Rating',
        table: 'sales',
        column: 'Rating',
        aggregation: 'AVG',
      });
      const result = planner.buildMetricExpr({ ...makeIntent(), metric: avgField }, aliases);
      expect(result.metricExpr).toContain('AVG(');
    });

    it('defaults to SUM when no aggregation specified', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const field = makeField({
        id: 'sales::Amount',
        table: 'sales',
        column: 'Amount',
        aggregation: undefined,
      });
      const result = planner.buildMetricExpr({ ...makeIntent(), metric: field }, aliases);
      expect(result.metricExpr).toContain('SUM(');
    });

    it('returns null metricExpr for list_values analysisType', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildMetricExpr(
        { ...makeIntent(), analysisType: 'list_values', metric: salesField },
        aliases,
      );
      expect(result.metricExpr).toBeNull();
    });

    it('returns metricFormat from metric field', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const currencyField = makeField({
        id: 'sales::Revenue',
        table: 'sales',
        column: 'Revenue',
        format: 'currency',
      });
      const result = planner.buildMetricExpr({ ...makeIntent(), metric: currencyField }, aliases);
      expect(result.metricFormat).toBe('currency');
    });
  });

  // ───────────────────────────────────────────────
  // buildWhereParts()
  // ───────────────────────────────────────────────

  describe('buildWhereParts()', () => {
    it('returns empty array when no filters and no date range', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildWhereParts(makeIntent({ filters: [] }), aliases);
      expect(result).toEqual([]);
    });

    it('handles multiple filters', () => {
      const planner = makePlanner({
        relationships: () => twoTableRelationships,
      });
      const aliases = new Map([
        ['sales', 't0_sales'],
        ['customer', 't1_customer'],
      ]);
      const result = planner.buildWhereParts(
        makeIntent({
          filters: [
            { field: regionField, operator: '=', value: 'East' },
            { field: categoryField, operator: 'IN', values: ['A', 'B'] },
          ],
        }),
        aliases,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('"Region" = \'East\'');
      expect(result[1]).toContain('IN');
      expect(result[1]).toContain("'A', 'B'");
    });
  });

  // ───────────────────────────────────────────────
  // buildWhereConditions()
  // ───────────────────────────────────────────────

  describe('buildWhereConditions()', () => {
    it('returns empty array when no filters and no date range', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildWhereConditions(makeIntent({ filters: [] }), aliases);
      expect(result).toEqual([]);
    });

    it('returns structured eq condition for equality filter', () => {
      const planner = makePlanner({ relationships: () => twoTableRelationships });
      const aliases = new Map([
        ['sales', 't0_sales'],
        ['customer', 't1_customer'],
      ]);
      const result = planner.buildWhereConditions(
        makeIntent({ filters: [{ field: regionField, operator: '=', value: 'East' }] }),
        aliases,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        kind: 'eq',
        tableAlias: 't1_customer',
        column: 'Region',
        value: 'East',
      });
    });

    it('returns structured in condition for IN filter', () => {
      const planner = makePlanner({ relationships: () => twoTableRelationships });
      const aliases = new Map([
        ['sales', 't0_sales'],
        ['customer', 't1_customer'],
      ]);
      const result = planner.buildWhereConditions(
        makeIntent({ filters: [{ field: regionField, operator: 'IN', values: ['East', 'West'] }] }),
        aliases,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        kind: 'in',
        tableAlias: 't1_customer',
        column: 'Region',
        values: ['East', 'West'],
      });
    });

    it('preserves all IN values including those with special characters', () => {
      const planner = makePlanner({ relationships: () => twoTableRelationships });
      const aliases = new Map([
        ['sales', 't0_sales'],
        ['customer', 't1_customer'],
      ]);
      const result = planner.buildWhereConditions(
        makeIntent({
          filters: [{ field: regionField, operator: 'IN', values: ["O'Brien's", 'East'] }],
        }),
        aliases,
      );
      expect(result[0]).toMatchObject({ kind: 'in', values: ["O'Brien's", 'East'] });
    });

    it('returns date_range condition for start/end date range', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildWhereConditions(
        makeIntent({
          dateRange: { field: timeField, start: '2024-01-01', end: '2024-12-31', text: 'in 2024' },
        }),
        aliases,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        kind: 'date_range',
        start: '2024-01-01',
        end: '2024-12-31',
      });
    });

    it('returns month_of_year condition for monthOfYear date range', () => {
      const planner = makePlanner();
      const aliases = new Map([['sales', 't0_sales']]);
      const result = planner.buildWhereConditions(
        makeIntent({
          dateRange: { field: timeField, kind: 'monthOfYear', month: 3, text: 'in March' },
        }),
        aliases,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ kind: 'month_of_year', month: 3 });
    });

    it('combines filter conditions and date range', () => {
      const planner = makePlanner({ relationships: () => twoTableRelationships });
      const aliases = new Map([
        ['sales', 't0_sales'],
        ['customer', 't1_customer'],
      ]);
      const result = planner.buildWhereConditions(
        makeIntent({
          filters: [{ field: regionField, operator: '=', value: 'East' }],
          dateRange: { field: timeField, start: '2024-01-01', end: '2024-12-31', text: 'in 2024' },
        }),
        aliases,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ kind: 'eq' });
      expect(result[1]).toMatchObject({ kind: 'date_range' });
    });
  });
});
