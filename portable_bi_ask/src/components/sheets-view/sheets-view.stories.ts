import './index';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { DashboardConfig } from '../../types';

type SheetsViewArgs = {
  config: DashboardConfig;
  slug: string;
  isNew: boolean;
};

const EMPTY_CONFIG: DashboardConfig = {
  title: 'Sample Dashboard',
  subtitle: 'Your Data, Any Data, Instantly Explained',
  dataSources: [],
  askData: { defaultQuestion: '' },
  filters: [],
  kpis: [],
  charts: [],
  tables: [],
  layout: [],
};

const meta = {
  title: 'Components/SheetsView',
  component: 'sheets-view',
  tags: ['autodocs', '!test'],
  render: ({ config, slug, isNew }: SheetsViewArgs) =>
    html`<sheets-view .config=${config} .slug=${slug} .isNew=${isNew}></sheets-view>`,
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
          'Orchestrates the sheet tab bar (`sheets-manager`), the absolute-positioned canvas (`sheet-canvas`), ' +
          'and the widget editor dialog (`sheet-editor`). ' +
          'Persists sheet layouts to `localStorage`, executes widget queries via DuckDB WASM, ' +
          'and emits `sheets-ask` / `sheets-data-loaded` events so hosts can observe ask activity and active-sheet data readiness.',
      },
    },
  },
} satisfies Meta<SheetsViewArgs>;

export default meta;
type Story = StoryObj<SheetsViewArgs>;

export const NewDashboard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Fresh dashboard — blank canvas with one default sheet tab and no widgets.',
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
          'Loads sheets from `localStorage["sheets:storybook-demo"]`. ' +
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
          'Same as New Dashboard — click the "Edit" button in the sheets manager to enter edit mode ' +
          'and reveal the "Add Question" toolbar.',
      },
    },
  },
};
