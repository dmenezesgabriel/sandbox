import './datasource-editor-panel';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import type { DataSourceConfig } from '../../../../shared/types/index';
import { createEmptyDatasourceConfig } from '../../model/datasource-config';

function makeConfig(overrides: Partial<DataSourceConfig> = {}): DataSourceConfig {
  return {
    ...createEmptyDatasourceConfig(),
    name: 'sales',
    url: 'https://raw.githubusercontent.com/chinmoy2306/superstore_sales_analysis/refs/heads/main/sales.csv',
    type: 'csv',
    description: 'Superstore sales transactions',
    ...overrides,
  };
}

const meta = {
  title: 'Features/DatasourceEditorPanel',
  component: 'datasource-editor-panel',
  tags: ['autodocs'],
  render: (args: {
    config: DataSourceConfig | null;
    readonly?: boolean;
    nameError?: string;
    urlError?: string;
  }) => html`
    <div style="max-width: 560px; padding: 1.5rem;">
      <datasource-editor-panel
        .config=${args.config}
        .readonly=${args.readonly ?? false}
        .nameError=${args.nameError ?? ''}
        .urlError=${args.urlError ?? ''}
      ></datasource-editor-panel>
    </div>
  `,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Form panel for editing a datasource configuration. Supports name, description, source type and URL fields, plus an inline connection test that shows detected column schema.',
      },
    },
  },
} satisfies Meta<{
  config: DataSourceConfig | null;
  readonly?: boolean;
  nameError?: string;
  urlError?: string;
}>;

export default meta;
type Story = StoryObj<{
  config: DataSourceConfig | null;
  readonly?: boolean;
  nameError?: string;
  urlError?: string;
}>;

export const NewDatasource: Story = {
  args: {
    config: makeConfig({ name: '', url: '', description: '' }),
  },
};

export const ExistingDatasource: Story = {
  args: {
    config: makeConfig(),
  },
};

export const ParquetType: Story = {
  args: {
    config: makeConfig({
      name: 'analytics',
      type: 'parquet',
      url: 'https://example.com/analytics.parquet',
      description: 'Analytics events parquet file',
    }),
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (YAML-sourced)',
  args: {
    config: makeConfig({ source: 'yaml' }),
    readonly: true,
  },
};

export const ValidationErrors: Story = {
  args: {
    config: makeConfig({ name: '', url: '' }),
    nameError: 'Name is required.',
    urlError: 'URL is required.',
  },
};
