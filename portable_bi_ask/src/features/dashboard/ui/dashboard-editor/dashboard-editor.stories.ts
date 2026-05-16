import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { DashboardConfig } from '../../../../shared/types/index';

type DashboardEditorArgs = {
  config: DashboardConfig | null;
  slug: string;
  isNew: boolean;
};

const EMPTY_CONFIG: DashboardConfig = {
  title: 'Sample Dashboard',
  subtitle: 'Your Data, Any Data, Instantly Explained',
  dataSourceSlugs: [],
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
      description: 'URL slug identifying the dashboard; used by the top-nav back-link.',
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
          'Template-level composition for the dashboard workspace. ' +
          'Renders the global top nav (brand + back link), the dashboard editor header ' +
          '(title, mode switcher, edit toggle), and the active panel (canvas or Ask Data). ' +
          'Mode and edit state are owned internally and driven by the header component events.',
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
        story:
          'New dashboard opened in Editor mode — empty canvas visible, ' +
          'header shows "Editor" button active and an "Edit" toggle.',
      },
    },
  },
};

export const AskDataConfig: Story = {
  name: 'Ask Data config (shell)',
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
          'Dashboard with example questions configured. ' +
          'Switch to Ask Data mode using the header mode buttons to see the ask interface. ' +
          'Submitting a query will initialise DuckDB — use with a real data source.',
      },
    },
  },
};

export const NoConfig: Story = {
  args: { config: null },
  globals: { a11y: { manual: true } },
  parameters: {
    docs: {
      description: { story: '`config` is `null` — renders the nav and header with empty title.' },
    },
  },
};
