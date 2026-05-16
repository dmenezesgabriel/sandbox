import './datasource-editor';

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta = {
  title: 'Features/DatasourceEditor',
  component: 'datasource-editor',
  tags: ['autodocs'],
  render: (args: { slug: string; isNew?: boolean }) => html`
    <div style="min-height: 600px;">
      <datasource-editor .slug=${args.slug} .isNew=${args.isNew ?? false}></datasource-editor>
    </div>
  `,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full editor page for a datasource. Loads from the registry by slug. Shows breadcrumb, header with save/delete/export actions, and the editor panel.',
      },
    },
  },
} satisfies Meta<{ slug: string; isNew?: boolean }>;

export default meta;
type Story = StoryObj<{ slug: string; isNew?: boolean }>;

export const ExistingDatasource: Story = {
  args: {
    slug: 'superstore-sales',
    isNew: false,
  },
};

export const ReadOnlyYaml: Story = {
  name: 'Read-only (YAML-sourced)',
  args: {
    slug: 'superstore-customers',
    isNew: false,
  },
};

export const NewDatasource: Story = {
  args: {
    slug: 'new',
    isNew: true,
  },
};

export const NotFound: Story = {
  args: {
    slug: 'does-not-exist',
    isNew: false,
  },
};
