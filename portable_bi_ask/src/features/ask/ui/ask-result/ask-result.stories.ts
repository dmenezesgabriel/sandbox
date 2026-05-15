import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { AskSuccessResult } from '../../../../shared/types/index';

type AskResultArgs = { result: AskSuccessResult | null };

const DECISION_BAR = {
  path: ['grouped', 'bar'],
  recommended: 'bar' as const,
  rendered: 'bar' as const,
  alternatives: ['pie'],
  reason: 'Grouped metric with a categorical dimension.',
};

const METRICS = { catalogBuildMs: 12, parseMs: 45, sqlExecutionMs: 88, totalAskMs: 150 };

const INTENT_BASE = {
  question: 'sales by region',
  analysisType: 'ranking' as const,
  metric: null,
  dimensions: [],
  filters: [],
  timeField: null,
  sort: { by: 'value', direction: 'DESC' as const },
};

const barResult: AskSuccessResult = {
  question: 'sales by region',
  interpretation: 'SUM(Sales) by Region, sorted descending, limit 25',
  intent: INTENT_BASE,
  sql: 'SELECT region AS label, SUM(sales) AS value FROM sales GROUP BY 1 ORDER BY 2 DESC LIMIT 25',
  rows: [
    { label: 'West', value: 744294 },
    { label: 'East', value: 606351 },
    { label: 'Central', value: 514251 },
    { label: 'South', value: 396641 },
  ],
  columns: ['label', 'value'],
  shape: {
    columns: ['label', 'value'],
    rowCount: 4,
    numeric: ['value'],
    categoric: ['label'],
    time: [],
    numericCount: 1,
    categoricCount: 1,
    timeCount: 0,
    seriesCount: 0,
    groupCount: 4,
    hasMetric: true,
    oneObservationPerGroup: true,
  },
  diagnostics: {},
  chartDecision: DECISION_BAR,
  insights: [
    'West is highest at $744,294 (32.9% of total).',
    'South is lowest at $396,641.',
    'Top 3 groups account for 82.5% of total.',
  ],
  narratives: {
    narratives: [
      {
        type: 'distribution',
        title: 'Concentrated distribution',
        text: 'The top 3 groups (West, East, Central) account for 82.5% of the total.',
        importance: 8,
      },
      {
        type: 'pattern',
        title: 'Highest performer',
        text: 'West leads with $744,294 (32.9% of total).',
        importance: 8,
      },
    ],
    summary: 'The top 3 groups (West, East, Central) account for 82.5% of the total.',
    keyTakeaway: 'West leads regional sales at 32.9% of total.',
  },
  evidence: [],
  chartType: 'bar',
  warnings: [],
  confidence: 0.95,
  metrics: METRICS,
};

const kpiResult: AskSuccessResult = {
  ...barResult,
  question: 'total sales',
  interpretation: 'SUM(Sales)',
  sql: 'SELECT SUM(sales) AS value FROM sales',
  rows: [{ value: 2261537 }],
  columns: ['value'],
  chartType: 'kpi',
  chartDecision: { ...DECISION_BAR, recommended: 'kpi', rendered: 'kpi' },
  insights: [],
  narratives: null,
};

const tableResult: AskSuccessResult = {
  ...barResult,
  chartType: 'table',
  chartDecision: { ...DECISION_BAR, rendered: 'table' },
};

const withWarning: AskSuccessResult = {
  ...barResult,
  warnings: ['Join produced 1.8x fan-out — values may be inflated. Check relationships.'],
};

const longLabelsResult: AskSuccessResult = {
  ...barResult,
  interpretation: 'SUM(Revenue) by Customer Segment and Fulfilment Program',
  rows: [
    { label: 'North America Enterprise Accounts', value: 744294 },
    { label: 'APAC Mid-Market Expansion Program', value: 606351 },
    { label: 'LATAM Partner-led Growth Initiative', value: 514251 },
  ],
};

const meta = {
  title: 'Organisms/Ask Result',
  component: 'ask-result',
  tags: ['autodocs'],
  render: ({ result }: AskResultArgs) => html`<ask-result .result=${result}></ask-result>`,
  argTypes: {
    result: {
      control: 'object',
      description:
        'The full `AskSuccessResult` returned by the query engine. `null` renders nothing.',
    },
  },
  args: { result: barResult },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Ask Data result organism. Combines narrative copy, Chart.js visualisation, export actions built from shared button atoms, ' +
          'a tabular fallback, and a collapsible SQL / diagnostics panel for the same query result.',
      },
    },
  },
} satisfies Meta<AskResultArgs>;

export default meta;
type Story = StoryObj<AskResultArgs>;

export const BarChart: Story = {
  name: 'Bar Chart Result',
  parameters: {
    docs: {
      description: {
        story:
          'Grouped metric query with regional breakdown rendered as a bar chart plus AI narrative.',
      },
    },
  },
};

export const KPI: Story = {
  name: 'KPI Result',
  args: { result: kpiResult },
  parameters: {
    docs: {
      description: {
        story: 'Single aggregate value rendered as a large KPI number with no chart.',
      },
    },
  },
};

export const Table: Story = {
  name: 'Table-only Result',
  args: { result: tableResult },
  parameters: {
    docs: {
      description: {
        story: 'When the chart decision falls back to table, only the data grid is shown.',
      },
    },
  },
};

export const WithWarning: Story = {
  name: 'Result with Warning',
  args: { result: withWarning },
  parameters: {
    docs: {
      description: {
        story:
          'Query engine warning banner is shown above the chart when data quality issues are detected.',
      },
    },
  },
};

export const LongLabels: Story = {
  name: 'Long Labels and Dense Copy',
  args: { result: longLabelsResult },
  parameters: {
    docs: {
      description: {
        story:
          'Representative content stress case used to verify that verbose business labels and longer interpretation text remain readable.',
      },
    },
  },
};

export const Empty: Story = {
  args: { result: null },
  globals: { a11y: { manual: true } },
  parameters: {
    docs: {
      description: { story: 'No result yet — component renders nothing (expected blank canvas).' },
    },
  },
};
