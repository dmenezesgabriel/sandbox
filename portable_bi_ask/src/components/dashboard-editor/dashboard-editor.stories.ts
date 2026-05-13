import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { DashboardConfig } from '../../types';

type DashboardEditorArgs = {
  config: DashboardConfig | null;
  slug: string;
  isNew: boolean;
};

const EMPTY_CONFIG: DashboardConfig = {
  title: 'Sample Dashboard',
  subtitle: 'Your Data, Any Data, Instantly Explained',
  dataSources: [],
  askData: { defaultQuestion: 'Show me total sales' },
  filters: [],
  kpis: [],
  charts: [],
  tables: [],
  layout: [],
};

const meta = {
  title: 'Templates/Dashboard Editor',
  component: 'dashboard-editor',
  tags: ['autodocs', '!test'],
  render: ({ config, slug, isNew }: DashboardEditorArgs) =>
    html`<dashboard-editor .config=${config} .slug=${slug} .isNew=${isNew}></dashboard-editor>`,
  argTypes: {
    config: {
      control: 'object',
      description: '`DashboardConfig` loaded from the registry. `null` renders an empty shell.',
    },
    slug: {
      control: 'text',
      description: 'URL slug identifying the dashboard; shown in the top-nav back-link.',
      table: { defaultValue: { summary: '""' } },
    },
    isNew: {
      control: 'boolean',
      description:
        'When `true` a blank sheet is created instead of loading persisted sheets from localStorage.',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    config: EMPTY_CONFIG,
    slug: 'sample-dashboard',
    isNew: true,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Template-level composition for the dashboard workspace. Renders the top navigation, ' +
          'sheet workspace template, and Ask Data flow together so layout and state relationships can be reviewed in one place. ' +
          'DuckDB is initialised on-demand when the user first submits a natural-language query.',
      },
    },
  },
} satisfies Meta<DashboardEditorArgs>;

export default meta;
type Story = StoryObj<DashboardEditorArgs>;

export const DashboardTab: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Editor opened on a new dashboard — empty canvas with Editor tab active.',
      },
    },
  },
};

export const AskDataTab: Story = {
  name: 'Ask Data Tab (shell)',
  args: {
    config: {
      ...EMPTY_CONFIG,
      askData: {
        defaultQuestion: 'What are total sales by region?',
        examples: ['Total sales', 'Sales by region', 'Top 5 products'],
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Ask Data panel with example questions listed. ' +
          'Submitting a query will initialise DuckDB — use with a real data source in a live environment.',
      },
    },
  },
};

export const NoConfig: Story = {
  args: { config: null },
  globals: { a11y: { manual: true } },
  parameters: {
    docs: { description: { story: '`config` is `null` — renders an empty nav shell.' } },
  },
};
