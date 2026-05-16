import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { DashboardConfig } from '../../../../shared/types/index';

type DashboardWorkspaceArgs = {
  config: DashboardConfig;
  slug: string;
  isNew: boolean;
};

const EMPTY_CONFIG: DashboardConfig = {
  title: 'Sample Dashboard',
  subtitle: 'Your Data, Any Data, Instantly Explained',
  dataSourceSlugs: [],
  askData: { defaultQuestion: '' },
  filters: [],
  kpis: [],
  charts: [],
  tables: [],
  layout: [],
};

const STORYBOOK_STORAGE_KEY = 'dashboard:storybook-populated';
const POPULATED_SHEETS = [
  {
    id: 'sheet-1',
    name: 'Overview',
    type: 'layout' as const,
    widgets: [
      {
        id: 'widget-1',
        type: 'text' as const,
        title: 'Narrative',
        textContent: 'Focus West region for the next planning cycle.',
      },
      {
        id: 'widget-2',
        type: 'text' as const,
        title: 'Owner',
        textContent: 'Sales Operations — Q3 revenue review',
      },
    ],
    layout: [
      { x: 16, y: 16, w: 360, h: 180 },
      { x: 392, y: 16, w: 360, h: 180 },
    ],
  },
];

const meta = {
  title: 'Templates/Dashboard Workspace',
  component: 'dashboard-workspace',
  tags: ['autodocs', '!test'],
  render: ({ config, slug, isNew }: DashboardWorkspaceArgs) =>
    html`<dashboard-workspace
      .config=${config}
      .slug=${slug}
      .isNew=${isNew}
    ></dashboard-workspace>`,
  argTypes: {
    config: {
      control: 'object',
      description:
        '`DashboardConfig` used to bootstrap the default sheet. Drives AskData engine initialisation.',
    },
    slug: {
      control: 'text',
      description: 'Dashboard slug used as a localStorage namespace key for sheet persistence.',
      table: { defaultValue: { summary: '""' } },
    },
    isNew: {
      control: 'boolean',
      description: 'When `true` skips localStorage and creates a blank sheet from `config`.',
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
          'Template for a single-dashboard workspace. Composes the canvas organism (`dashboard-canvas`) ' +
          'and widget editor dialog (`widget-editor`). Persists the dashboard layout to `localStorage`, executes widget queries via DuckDB WASM, ' +
          'and emits `dashboard-ask` / `dashboard-data-loaded` events so hosts can observe ask activity and data readiness.',
      },
    },
  },
} satisfies Meta<DashboardWorkspaceArgs>;

export default meta;
type Story = StoryObj<DashboardWorkspaceArgs>;

export const NewDashboard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Fresh dashboard — blank canvas with one default dashboard sheet and no widgets.',
      },
    },
  },
};

export const MultipleSheets: Story = {
  name: 'With Persisted Sheets (localStorage)',
  args: { isNew: false, slug: 'storybook-demo' },
  parameters: {
    docs: {
      description: {
        story:
          'Loads the persisted dashboard from `localStorage["dashboard:storybook-demo"]`. ' +
          'Falls back to a blank default sheet if no data is stored.',
      },
    },
  },
};

export const EditModeView: Story = {
  name: 'Edit Mode (new)',
  parameters: {
    docs: {
      description: {
        story:
          'Same as New Dashboard — enable edit mode from the dashboard header to reveal the "Add Question" toolbar.',
      },
    },
  },
};

export const PopulatedWorkspace: Story = {
  name: 'Populated Workspace Template',
  args: { isNew: false, slug: 'storybook-populated' },
  decorators: [
    (story) => {
      localStorage.setItem(
        STORYBOOK_STORAGE_KEY,
        JSON.stringify({ version: 3, data: POPULATED_SHEETS }),
      );
      return story();
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Representative-content template story. Seeds localStorage with a realistic persisted sheet so layout, spacing, and toolbar actions can be reviewed against non-empty content.',
      },
    },
  },
};
