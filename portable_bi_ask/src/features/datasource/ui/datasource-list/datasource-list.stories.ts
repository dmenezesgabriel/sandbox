import './datasource-list';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

import { addDatasource, deleteDatasource } from '../../data/datasource-registry';

const meta = {
  title: 'Features/DatasourceList',
  component: 'datasource-list',
  tags: ['autodocs'],
  render: () => html`
    <div style="max-width: 900px; padding: 1rem;">
      <datasource-list></datasource-list>
    </div>
  `,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Collection page listing all registered datasources. Seed (YAML) entries are read-only; user-created entries support edit and delete.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: 'Default (seed entries)',
};

export const WithUserEntry: Story = {
  name: 'Mixed — seed + user entry',
  decorators: [
    (story) => {
      const ds = addDatasource({
        name: 'my-sales',
        type: 'csv',
        url: 'https://example.com/my-sales.csv',
        description: 'Custom sales file',
      });
      const el = story() as Node;
      // Clean up after story unmounts (best-effort)
      setTimeout(() => {
        try {
          deleteDatasource(ds.slug);
        } catch {
          /* ignore */
        }
      }, 5000);
      return el;
    },
  ],
};
